import Fastify from "fastify";
import { z } from "zod";
import { createDashboardTicket } from "./dashboard-client.js";
import { closePool, pool } from "./db.js";
import { classifyIntent, generateGroundedAnswer, generateSessionRecallAnswer, generateSessionSummary } from "./openrouter.js";
import { callMcpTool, formatContext } from "./mcp-client.js";
import { validateResponse } from "./validator.js";
import {
  appendMessage,
  getRecentMessages,
  loadOrCreateSession,
  SessionNotFoundError,
  type ChatMessage,
  type ChatSession,
  updateSession,
} from "./session-store.js";

const chatSchema = z.object({
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  message: z.string().min(1),
  userProfile: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
    .strict()
    .optional(),
}).strict();

const app = Fastify({ logger: true });

const sttServiceUrl = process.env.SONIOX_SERVICE_URL ?? "http://localhost:8001";

app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, payload, done) => {
  done(null, payload);
});

app.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    request.headers["access-control-request-headers"] ?? "content-type",
  );

  if (request.method === "OPTIONS") {
    return reply.status(204).send();
  }
});

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { ok: true, service: "chatbot-api" };
});

app.post("/voice", async (request, reply) => {
  const audio = request.body;
  if (!Buffer.isBuffer(audio) || audio.length === 0) {
    return reply.status(400).send({
      error: "empty_audio",
      message: "No audio data received.",
    });
  }

  let sttResponse: Response;
  try {
    sttResponse = await fetch(`${sttServiceUrl}/voice`, {
      method: "POST",
      headers: { "Content-Type": request.headers["content-type"] ?? "application/octet-stream" },
      body: new Uint8Array(audio),
    });
  } catch (error) {
    app.log.error(error);
    return reply.status(502).send({
      error: "stt_unreachable",
      message: "Speech-to-text service is unavailable.",
    });
  }

  const data = await sttResponse.json();
  if (!sttResponse.ok) {
    return reply.status(502).send(data);
  }

  return reply.send(data);
});

app.post("/chat", async (request, reply) => {
  if (hasLegacyIdField(request.body)) {
    return reply.status(400).send({
      error: "invalid_session_field",
      message: "Use sessionId to continue a chat session.",
    });
  }

  const parsedInput = chatSchema.safeParse(request.body);
  if (!parsedInput.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: z.treeifyError(parsedInput.error),
    });
  }

  const input = parsedInput.data;
  let session: ChatSession;
  try {
    session = await loadOrCreateSession(input.sessionId, input.userId);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return reply.status(404).send({
        error: "session_not_found",
        message: "Chat session not found.",
      });
    }
    throw error;
  }

  const priorMessages = await getRecentMessages(session.id, 5);
  session = await updateSession(session.id, {
    currentFlow: session.currentFlow,
    currentState: session.currentState,
    context: mergeProfileMemory(session.context, input.message, input.userProfile),
  });
  await appendMessage(session.id, "user", input.message);

  if (isSessionRecallQuestion(input.message)) {
    const responseText = await generateSessionRecallAnswer(input.message, priorMessages);
    const action = { type: "session_recall", messageCount: priorMessages.length };
    await appendMessage(session.id, "assistant", responseText, { metadata: { action } });
    await logChat(session.id, input.message, "session_recall", 1, responseText);
    return reply.send(toChatResponse(session, { intent: "session_recall", confidence: 1 }, responseText, action));
  }

  const intent = await classifyIntent(input.message);
  const shouldHandleHumanHandoff = shouldContinueComplaintFlow(session) || isHumanHandoffIntent(intent, session, input.message);
  if (!shouldHandleHumanHandoff) {
    session = await updateSession(session.id, {
      currentFlow: session.currentFlow,
      currentState: session.currentState,
      context: mergeConversationMemory(session.context, input.message, intent.entities),
    });
  }

  let responseText: string;
  let context = "";
  let action: Record<string, unknown> | null = null;

  if (intent.intent === "emergency") {
    responseText =
      "Đây có thể là tình trạng cần cấp cứu. Anh/chị vui lòng gọi 115 hoặc đến khoa Cấp cứu gần nhất ngay. " +
      "Nếu đang ở trong bệnh viện, tôi có thể hướng dẫn đường đến Khoa Cấp cứu.";
    action = { type: "emergency_response", signals: intent.emergencySignals };
  } else if (shouldHandleHumanHandoff) {
    const result = await handleComplaintFlow(session, input.message, intent);
    session = result.session;
    responseText = result.responseText;
    action = result.action;
  } else if (shouldContinueNavigationFlow(session, intent.intent)) {
    const result = await handleNavigationFlow(session, input.message);
    session = result.session;
    responseText = result.responseText;
    action = result.action;
  } else if (shouldContinueMedicalFlow(session, intent.intent)) {
    const result = await handleMedicalConsultationFlow(session, input.message);
    session = result.session;
    responseText = result.responseText;
    action = result.action;
  } else if (shouldContinueAppointmentFlow(session, intent.intent)) {
    const result = await handleAppointmentFlow(session, input.message);
    session = result.session;
    responseText = result.responseText;
    action = result.action;
  } else if (intent.intent === "department_information") {
    const toolName = "search_department";
    const results = await callMcpTool(toolName, buildContextualQuery(session, input.message), 5);
    context = formatContext(results);
    const answer = await generateGroundedAnswer(await buildSessionQuestion(session, input.message), context);
    const validation = validateResponse(answer, context);
    responseText = addDepartmentFollowUp(validation.answer);
    action = { type: "mcp_search", toolName, validationReason: validation.reason };
    session = await updateSession(session.id, {
      currentFlow: "hospital_information",
      currentState: null,
      context: session.context,
    });
  } else if (intent.intent === "service_price") {
    const insuranceInquiry = isInsuranceInquiry(input.message, intent) || session.currentFlow === "insurance_inquiry";
    const toolName = insuranceInquiry ? selectInsuranceTool(input.message) : "search_price";
    const query = insuranceInquiry ? buildInsuranceQuery(session, input.message) : buildContextualQuery(session, input.message);
    const results = await callMcpTool(toolName, query, 10);
    context = formatContext(results);
    const answer = await generateGroundedAnswer(await buildSessionQuestion(session, input.message), context);
    const validation = validateResponse(answer, context);
    responseText = insuranceInquiry ? addInsuranceFollowUp(validation.answer, input.message) : validation.answer;
    action = { type: "mcp_search", toolName, validationReason: validation.reason };
    session = await updateSession(session.id, {
      currentFlow: insuranceInquiry ? "insurance_inquiry" : "service",
      currentState: null,
      context: insuranceInquiry ? { ...session.context, last_topic: "BHYT" } : session.context,
    });
  } else if (intent.intent === "doctor_availability") {
    const toolName = "search_doctor";
    const results = await callMcpTool(toolName, buildContextualQuery(session, input.message), 5);
    context = formatContext(results);
    const answer = await generateGroundedAnswer(await buildSessionQuestion(session, input.message), context);
    const validation = validateResponse(answer, context);
    responseText = `${validation.answer}\n\nAnh/chị muốn đặt lịch với bác sĩ nào?`;
    action = { type: "mcp_search", toolName, validationReason: validation.reason };
    session = await updateSession(session.id, {
      currentFlow: "appointment",
      currentState: "waiting_doctor",
      context: { ...session.context, department: getString(session.context.department) ?? "Tim mạch" },
    });
  } else if (intent.intent === "navigation") {
    const result = await startNavigationFlow(session, input.message, intent.entities);
    session = result.session;
    responseText = result.responseText;
    action = result.action;
  } else if (intent.intent === "medical_consultation") {
    const result = await startMedicalConsultationFlow(session, input.message);
    session = result.session;
    responseText = result.responseText;
    action = result.action;
  } else if (intent.intent === "appointment") {
    if (isAppointmentGuidanceQuestion(input.message)) {
      const toolName = "search_policy";
      const results = await callMcpTool(toolName, input.message, 5);
      context = formatContext(results);
      const answer = await generateGroundedAnswer(await buildSessionQuestion(session, input.message), context);
      const validation = validateResponse(answer, context);
      responseText = validation.answer;
      action = { type: "mcp_search", toolName, validationReason: validation.reason };
    } else {
      const appointment = startAppointmentContext(session.context, input.message, intent.entities);
      const nextState = getNextAppointmentState(appointment);
      if (nextState) {
        session = await updateSession(session.id, {
          currentFlow: "appointment",
          currentState: nextState,
          context: appointment,
        });
        responseText = appointmentQuestion(nextState, appointment);
        action = { type: "session_state_updated", flow: "appointment", state: nextState };
      } else {
        const completed = await completeAppointmentBooking(session, appointment);
        session = completed.session;
        responseText = completed.responseText;
        action = completed.action;
      }
    }
  } else if (intent.intent === "hospital_information") {
    const insuranceInquiry = isInsuranceInquiry(input.message, intent) || session.currentFlow === "insurance_inquiry";
    const toolName = insuranceInquiry ? selectInsuranceTool(input.message) : selectHospitalTool(input.message);
    const limit = toolName === "search_service" ? 10 : 5;
    const query = insuranceInquiry ? buildInsuranceQuery(session, input.message) : input.message;
    const results = await callMcpTool(toolName, query, limit);
    context = formatContext(results);
    const answer = await generateGroundedAnswer(await buildSessionQuestion(session, input.message), context);
    const validation = validateResponse(answer, context);
    responseText = insuranceInquiry ? addInsuranceFollowUp(validation.answer, input.message) : validation.answer;
    action = { type: "mcp_search", toolName, validationReason: validation.reason };
    if (insuranceInquiry) {
      session = await updateSession(session.id, {
        currentFlow: "insurance_inquiry",
        currentState: null,
        context: { ...session.context, last_topic: "BHYT" },
      });
    }
  } else {
    const results = await callMcpTool("search_knowledge", input.message, 5);
    context = formatContext(results);
    const answer = await generateGroundedAnswer(await buildSessionQuestion(session, input.message), context);
    const validation = validateResponse(answer, context);
    responseText = validation.answer;
    action = {
      type: "unknown_intent_mcp_fallback",
      toolName: "search_knowledge",
      validationReason: validation.reason,
    };
  }

  await appendMessage(session.id, "assistant", responseText, { metadata: { action } });
  session = await updateSessionSummary(session, intent, action);
  await logChat(session.id, input.message, intent.intent, intent.confidence, responseText);

  return reply.send(toChatResponse(session, intent, responseText, action));
});

function hasLegacyIdField(body: unknown): boolean {
  return typeof body === "object" && body !== null && !Array.isArray(body) && "id" in body;
}

function shouldContinueAppointmentFlow(session: ChatSession, intent: string): boolean {
  if (session.currentFlow !== "appointment" || !session.currentState) return false;
  return ["appointment", "unknown", "doctor_availability"].includes(intent);
}

function shouldContinueMedicalFlow(session: ChatSession, intent: string): boolean {
  if (session.currentFlow !== "medical_consultation" || !session.currentState) return false;
  if (session.currentState === "waiting_ticket_contact") return true;
  return ["medical_consultation", "unknown"].includes(intent);
}

function shouldContinueNavigationFlow(session: ChatSession, intent: string): boolean {
  if (session.currentFlow !== "navigation" || !session.currentState) return false;
  return ["navigation", "unknown"].includes(intent);
}

function shouldContinueComplaintFlow(session: ChatSession): boolean {
  return session.currentFlow === "complaint_handling" && session.currentState === "waiting_complaint_contact";
}

function isHumanHandoffIntent(intent: Record<string, unknown>, session: ChatSession, message: string): boolean {
  if (intent.intent === "emergency" || intent.intent === "medical_consultation") return false;

  const intentText = normalizeText([
    getString(intent.flow),
    getString(intent.action),
    getString(intent.intent),
    getString(session.context.session_summary),
  ].filter(Boolean).join(" "));

  return isComplaintMessage(message) ||
    Boolean(intent.needsHuman) ||
    [
      "complaint handling",
      "log complaint",
      "complaint",
      "khieu nai",
      "phan hoi tieu cuc",
      "phan anh",
      "khong hai long",
      "needshuman",
    ].some((phrase) => intentText.includes(phrase));
}

function isComplaintMessage(message: string): boolean {
  const text = normalizeText(message);
  const hasComplaintTopic = [
    "dich vu",
    "benh vien",
    "nhan vien",
    "bac si",
    "le tan",
    "thai do",
    "cho doi",
    "kham",
  ].some((word) => text.includes(word));
  const hasNegativeSignal = [
    "te",
    "qua te",
    "rat te",
    "khong hai long",
    "khieu nai",
    "phan anh",
    "phan hoi",
    "buc xuc",
    "kho chiu",
    "cham",
    "lau",
    "vl",
    "vcl",
    "cc",
  ].some((word) => text.includes(word));

  return hasComplaintTopic && hasNegativeSignal;
}

async function handleComplaintFlow(
  session: ChatSession,
  message: string,
  intent: Record<string, unknown>,
) {
  const context: Record<string, unknown> = {
    ...session.context,
    complaint_message: getString(session.context.complaint_message) ?? message.trim(),
    complaint_latest_message: message.trim(),
    complaint_intent: session.context.complaint_intent ?? intent,
    complaint_latest_intent: intent,
  };

  if (!getString(context.patient_name) || (!getString(context.patient_phone) && !getString(context.patient_email))) {
    const updated = await updateSession(session.id, {
      currentFlow: "complaint_handling",
      currentState: "waiting_complaint_contact",
      context,
    });

    return {
      session: updated,
      responseText: "Anh/chị vui lòng cho biết họ tên và số điện thoại để bệnh viện liên hệ xử lý phản hồi này.",
      action: { type: "session_state_updated", flow: "complaint_handling", state: "waiting_complaint_contact" },
    };
  }

  return createComplaintTicket(session, context);
}

async function createComplaintTicket(session: ChatSession, context: Record<string, unknown>) {
  const summary = getString(context.session_summary);
  const complaintMessage = getString(context.complaint_message) ?? getString(context.complaint_latest_message) ?? "Phản hồi/khiếu nại từ chatbot";
  const latestMessage = getString(context.complaint_latest_message);
  const description = [
    `Nội dung phản hồi: ${complaintMessage}`,
    latestMessage && latestMessage !== complaintMessage && isComplaintMessage(latestMessage) ? `Tin nhắn mới nhất: ${latestMessage}` : null,
    summary ? `Tóm tắt session: ${summary}` : null,
  ].filter(Boolean).join("\n\n");

  const ticket = await createDashboardTicket({
    title: "Phản hồi/khiếu nại từ chatbot",
    description,
    priority: "high",
    ticketType: "complaint",
    patientName: getString(context.patient_name),
    patientPhone: getString(context.patient_phone),
    patientEmail: getString(context.patient_email),
    metadata: { sessionId: session.id, context, sourceFlow: "complaint_handling" },
  });
  const updated = await updateSession(session.id, {
    currentFlow: null,
    currentState: null,
    context: { ...context, last_ticket: ticket },
  });

  return {
    session: updated,
    responseText: "Tôi đã ghi nhận phản hồi của anh/chị và chuyển đến bộ phận phụ trách. Bệnh viện sẽ liên hệ lại để hỗ trợ xử lý.",
    action: { type: "ticket_created", ticketType: "complaint", ticket },
  };
}

async function startNavigationFlow(session: ChatSession, message: string, entities: Record<string, unknown> = {}) {
  const origin =
    getString(entities.current_location) ??
    getString(entities.start_point) ??
    extractOrigin(message) ??
    getString(session.context.origin);
  const destination =
    getString(entities.destination) ??
    extractDestination(message) ??
    getString(session.context.destination) ??
    getString(session.context.last_department);
  const destinationDepartment = departmentFromDestination(destination);
  const context: Record<string, unknown> = {
    ...session.context,
    origin: origin ?? null,
    destination,
    last_department: destinationDepartment ?? getString(session.context.last_department),
    department: destinationDepartment ?? getString(session.context.department),
    last_topic: destinationDepartment ?? destination ?? session.context.last_topic ?? null,
  };

  if (!destination) {
    const updated = await updateSession(session.id, {
      currentFlow: "navigation",
      currentState: "waiting_destination",
      context,
    });

    return {
      session: updated,
      responseText: "Anh/chị muốn đến khoa, phòng hoặc khu vực nào trong bệnh viện?",
      action: { type: "session_state_updated", flow: "navigation", state: "waiting_destination" },
    };
  }

  const readySession = await updateSession(session.id, {
    currentFlow: "navigation",
    currentState: "routing",
    context,
  });
  return handleNavigationFlow(readySession, message);
}

async function handleNavigationFlow(session: ChatSession, message: string) {
  const origin = extractOrigin(message) ?? getString(session.context.origin);
  const destination =
    extractDestination(message) ??
    getString(session.context.destination) ??
    getString(session.context.last_department);
  const destinationDepartment = departmentFromDestination(destination) ?? getString(session.context.department);
  const context: Record<string, unknown> = {
    ...session.context,
    origin: origin ?? null,
    destination: destination ?? null,
    last_department: destinationDepartment ?? getString(session.context.last_department),
    department: destinationDepartment ?? getString(session.context.department),
    last_topic: destinationDepartment ?? destination ?? session.context.last_topic ?? null,
  };

  if (!destination) {
    const updated = await updateSession(session.id, {
      currentFlow: "navigation",
      currentState: "waiting_destination",
      context,
    });
    return {
      session: updated,
      responseText: "Anh/chị muốn đến khoa, phòng hoặc khu vực nào trong bệnh viện?",
      action: { type: "session_state_updated", flow: "navigation", state: "waiting_destination" },
    };
  }

  const toolName = "search_navigation";
  const query = [
    destination,
    destinationDepartment ? `Khoa ${destinationDepartment}` : null,
    origin ? `Vị trí hiện tại: ${origin}` : null,
    message,
  ].filter(Boolean).join("\n");
  const results = await callMcpTool(toolName, query, 5);

  if (!results.length) {
    const updated = await updateSession(session.id, {
      currentFlow: "navigation",
      currentState: "waiting_destination",
      context,
    });
    return {
      session: updated,
      responseText: "Tôi chưa có thông tin vị trí chi tiết cho điểm đến này. Anh/chị cho biết tên khoa, phòng hoặc khu vực cụ thể hơn được không?",
      action: { type: "mcp_search", toolName, resultCount: 0 },
    };
  }

  const updated = await updateSession(session.id, {
    currentFlow: "navigation",
    currentState: "routing",
    context: { ...context, selected_location: results[0] },
  });
  const groundedContext = formatContext(results);
  const answer = await generateGroundedAnswer(await buildSessionQuestion(updated, message), groundedContext);
  const validation = validateResponse(answer, groundedContext);
  return {
    session: updated,
    responseText: validation.answer,
    action: { type: "mcp_search", toolName, resultCount: results.length },
  };
}

async function startMedicalConsultationFlow(session: ChatSession, message: string) {
  const symptom = extractSymptom(message) ?? message.trim();
  const context: Record<string, unknown> = {
    ...session.context,
    symptom,
    symptoms: [...asStringArray(session.context.symptoms), symptom],
  };
  if (getString(context.patient_name) && (getString(context.patient_phone) || getString(context.patient_email))) {
    return continueTicketCreation(session, context);
  }

  const updated = await updateSession(session.id, {
    currentFlow: "medical_consultation",
    currentState: "waiting_ticket_contact",
    context,
  });

  return {
    session: updated,
    responseText:
      "Tôi không thể chẩn đoán bệnh qua chat. Anh/chị vui lòng cung cấp họ tên và số điện thoại hoặc email để bệnh viện liên hệ hỗ trợ.",
    action: { type: "session_state_updated", flow: "medical_consultation", state: "waiting_ticket_contact" },
  };
}

async function handleMedicalConsultationFlow(session: ChatSession, message: string) {
  const context = mergeProfileMemory(session.context, message);
  const choice = normalizeText(message);

  if (session.currentState === "waiting_consultation_choice") {
    if (choice.includes("1") || choice.includes("dat lich")) {
      const updated = await updateSession(session.id, {
        currentFlow: "appointment",
        currentState: getNextAppointmentState(context),
        context,
      });
      return {
        session: updated,
        responseText: appointmentQuestion(updated.currentState, updated.context),
        action: { type: "session_state_updated", flow: "appointment", state: updated.currentState },
      };
    }

    if (choice.includes("3") || choice.includes("hotline") || choice.includes("cap cuu")) {
      const updated = await updateSession(session.id, {
        currentFlow: "medical_consultation",
        currentState: "hotline_guidance",
        context,
      });
      return {
        session: updated,
        responseText: "Nếu triệu chứng nghiêm trọng, anh/chị vui lòng gọi 115 hoặc đến khoa Cấp cứu gần nhất. Hotline bệnh viện: 19001082.",
        action: { type: "hotline_guidance" },
      };
    }

    if (choice.includes("2") || choice.includes("dong y") || choice.includes("tu van") || choice.includes("gửi")) {
      return continueTicketCreation(session, context);
    }

    const symptom = extractSymptom(message) ?? message.trim();
    return startMedicalConsultationFlow(session, symptom);
  }

  if (session.currentState === "waiting_ticket_contact") {
    return continueTicketCreation(session, context);
  }

  return startMedicalConsultationFlow(session, message);
}

async function continueTicketCreation(session: ChatSession, context: Record<string, unknown>) {
  const missing: string[] = [];
  if (!getString(context.patient_name)) missing.push("họ tên");
  if (!getString(context.patient_phone) && !getString(context.patient_email)) missing.push("số điện thoại hoặc email");

  if (missing.length) {
    const updated = await updateSession(session.id, {
      currentFlow: "medical_consultation",
      currentState: "waiting_ticket_contact",
      context,
    });
    return {
      session: updated,
      responseText: `Anh/chị vui lòng cung cấp ${missing.join(" và ")} để tôi tạo yêu cầu tư vấn.`,
      action: { type: "session_state_updated", flow: "medical_consultation", state: "waiting_ticket_contact" },
    };
  }

  const ticket = await createDashboardTicket({
    title: "Yêu cầu tư vấn y tế từ chatbot",
    description: asStringArray(context.symptoms).join("\n") || getString(context.symptom) || "Yêu cầu tư vấn y tế từ chatbot",
    priority: "high",
    ticketType: "medical_consultation",
    patientName: getString(context.patient_name),
    patientPhone: getString(context.patient_phone),
    patientEmail: getString(context.patient_email),
    metadata: { sessionId: session.id, context },
  });
  const updated = await updateSession(session.id, {
    currentFlow: null,
    currentState: null,
    context: { ...context, last_ticket: ticket },
  });

  return {
    session: updated,
    responseText: formatTicketCreatedResponse(ticket, context),
    action: { type: "ticket_created", ticket },
  };
}

function formatTicketCreatedResponse(ticket: unknown, context: Record<string, unknown>): string {
  const ticketRecord = typeof ticket === "object" && ticket !== null ? ticket as Record<string, unknown> : {};
  const ticketId = getString(ticketRecord.id) ?? getString((ticketRecord.ticket as Record<string, unknown> | undefined)?.id);
  const patientName = getString(context.patient_name) ?? "Chưa rõ";
  const patientPhone = getString(context.patient_phone);
  const patientEmail = getString(context.patient_email);
  const symptom = asStringArray(context.symptoms).join(", ") || getString(context.symptom) || "Yêu cầu tư vấn y tế";
  const contact = [patientPhone ? `SĐT: ${patientPhone}` : null, patientEmail ? `Email: ${patientEmail}` : null]
    .filter(Boolean)
    .join(" | ");

  return [
    `Tôi đã tạo ticket tư vấn thành công${ticketId ? ` (${ticketId})` : ""}.`,
    `Thông tin đã nhận: Họ tên: ${patientName}${contact ? ` | ${contact}` : ""}.`,
    `Nội dung cần tư vấn: ${symptom}.`,
    "Chúng tôi đã nhận được yêu cầu và bộ phận chuyên môn sẽ liên hệ lại với anh/chị.",
  ].join("\n");
}

async function handleAppointmentFlow(session: ChatSession, message: string) {
  const context = collectAppointmentSlot(session.context, session.currentState, message);
  const nextState = getNextAppointmentState(context);

  if (nextState) {
    const updated = await updateSession(session.id, {
      currentFlow: "appointment",
      currentState: nextState,
      context,
    });
    return {
      session: updated,
      responseText: appointmentQuestion(nextState, context),
      action: { type: "session_state_updated", flow: "appointment", state: nextState },
    };
  }

  return completeAppointmentBooking(session, context);
}

async function completeAppointmentBooking(session: ChatSession, context: Record<string, unknown>) {
  const appointmentTicket = await createDashboardTicket({
    title: "Yêu cầu đặt lịch khám từ chatbot",
    description: [
      `Khoa: ${getString(context.department) ?? getString(context.last_department) ?? "Chưa rõ"}`,
      `Bác sĩ: ${getString(context.doctor) ?? "Không yêu cầu bác sĩ cụ thể"}`,
      `Ngày: ${getString(context.date) ?? getString(context.preferred_date) ?? "Chưa rõ"}`,
      `Giờ: ${getString(context.time) ?? getString(context.preferred_time) ?? "Chưa rõ"}`,
    ].join("\n"),
    priority: "normal",
    ticketType: "Đặt lịch khám đặc biệt",
    patientName: getString(context.patient_name),
    patientPhone: getString(context.patient_phone),
    metadata: { sessionId: session.id, context, sourceFlow: "appointment" },
  });
  const updatedContext = { ...context, last_appointment_ticket: appointmentTicket };
  const updated = await updateSession(session.id, {
    currentFlow: null,
    currentState: null,
    context: updatedContext,
  });

  return {
    session: updated,
    responseText: "Tôi đã ghi nhận yêu cầu đặt lịch. Bệnh viện sẽ xác nhận lịch hẹn trước khi cuộc hẹn có hiệu lực.",
    action: { type: "appointment_ticket_created", ticket: appointmentTicket },
  };
}

function startAppointmentContext(
  currentContext: Record<string, unknown>,
  message: string,
  entities: Record<string, unknown>,
) {
  return {
    ...currentContext,
    department: getString(entities.department) ?? extractDepartment(message) ?? getString(currentContext.department) ?? null,
    doctor: getString(entities.doctor) ?? getString(currentContext.doctor) ?? null,
    date: getString(entities.date) ?? extractDate(message) ?? getString(currentContext.date) ?? getString(currentContext.preferred_date) ?? null,
    time: getString(entities.time) ?? extractTime(message) ?? getString(currentContext.time) ?? getString(currentContext.preferred_time) ?? null,
  };
}

function collectAppointmentSlot(context: Record<string, unknown>, state: string | null, message: string) {
  const next = { ...context };

  if (state === "waiting_doctor") next.doctor = isNoPreference(message) ? "Không yêu cầu bác sĩ cụ thể" : normalizeSlot(message);
  if (state === "waiting_department") next.department = extractDepartment(message) ?? message.trim();
  if (state === "waiting_date") next.date = extractDate(message) ?? message.trim();
  if (state === "waiting_time") next.time = extractTime(message) ?? message.trim();
  if (state === "waiting_patient_name") next.patient_name = extractPatientName(message) ?? message.trim();
  if (state === "waiting_patient_phone") next.patient_phone = extractPhone(message) ?? message.trim();

  return next;
}

function getNextAppointmentState(context: Record<string, unknown>): string | null {
  if (!getString(context.department) && !getString(context.last_department)) return "waiting_department";
  if (!getString(context.date)) return "waiting_date";
  if (!getString(context.time)) return "waiting_time";
  if (!getString(context.patient_name)) return "waiting_patient_name";
  if (!getString(context.patient_phone)) return "waiting_patient_phone";
  return null;
}

function appointmentQuestion(state: string | null, context: Record<string, unknown>): string {
  const patientName = getString(context.patient_name);
  const prefix = patientName ? `Anh/chị ${patientName}, ` : "";

  if (state === "waiting_department") return "Anh/chị muốn đặt lịch khám khoa nào?";
  if (state === "waiting_date") return `${prefix}anh/chị muốn khám ngày nào?`;
  if (state === "waiting_time") return `${prefix}anh/chị muốn khám vào khung giờ nào?`;
  if (state === "waiting_patient_name") return "Anh/chị cho tôi xin họ tên người khám.";
  if (state === "waiting_patient_phone") return `${prefix}anh/chị cho tôi xin số điện thoại để bệnh viện xác nhận lịch hẹn.`;
  return "Tôi đã có đủ thông tin để ghi nhận yêu cầu đặt lịch.";
}

function mergeProfileMemory(
  context: Record<string, unknown>,
  message: string,
  userProfile?: { name?: string; phone?: string; email?: string },
) {
  const phone = userProfile?.phone ?? extractPhone(message) ?? getString(context.patient_phone);
  const email = userProfile?.email ?? extractEmail(message) ?? getString(context.patient_email);
  return {
    ...context,
    patient_name: userProfile?.name ?? extractPatientName(message, { phone, email }) ?? context.patient_name ?? null,
    patient_phone: phone ?? null,
    patient_email: email ?? null,
  };
}

function mergeConversationMemory(
  context: Record<string, unknown>,
  message: string,
  entities: Record<string, unknown>,
) {
  const department = getString(entities.department) ?? extractDepartment(message) ?? getString(context.department) ?? getString(context.last_department);
  const service = getString(entities.service) ?? extractService(message) ?? getString(context.last_service);
  const location =
    getString(entities.current_location) ??
    getString(entities.start_point) ??
    extractUserLocation(message) ??
    getString(context.user_location);
  const time = getString(entities.time) ?? extractTime(message) ?? getString(context.preferred_time) ?? getString(context.time);
  const date = getString(entities.date) ?? extractDate(message) ?? getString(context.preferred_date) ?? getString(context.date);
  const destination = getString(entities.destination) ?? extractDestination(message) ?? getString(context.destination);

  return {
    ...context,
    last_topic: department ?? service ?? getString(context.last_topic) ?? null,
    last_department: department ?? null,
    department: department ?? getString(context.department) ?? null,
    last_service: service ?? null,
    user_location: location ?? null,
    preferred_time: time ?? null,
    preferred_date: date ?? null,
    time: time ?? getString(context.time) ?? null,
    date: date ?? getString(context.date) ?? null,
    destination: destination ?? null,
  };
}

function buildContextualQuery(session: ChatSession, message: string) {
  const parts = [
    message,
    getString(session.context.last_department) ? `Khoa ${getString(session.context.last_department)}` : null,
    getString(session.context.last_service),
    getString(session.context.destination),
    getString(session.context.user_location) ? `Vị trí user: ${getString(session.context.user_location)}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

function buildInsuranceQuery(session: ChatSession, message: string) {
  const parts = [
    message,
    "BHYT bảo hiểm y tế",
    getString(session.context.last_topic),
  ];
  const text = normalizeText(message);
  if (["chuyen tuyen", "chuyen vien", "transfer policy"].some((word) => text.includes(word))) {
    parts.push("chuyển tuyến điều trị", "phiếu chuyển viện", "xin ý kiến Ban Giám đốc");
  }
  if (text.includes("don thuoc")) {
    parts.push("đơn thuốc BHYT", "duyệt đơn", "Kiểm soát BHYT");
  }
  return parts.filter(Boolean).join("\n");
}

function addDepartmentFollowUp(answer: string) {
  if (answer === "Tôi chưa có thông tin") return answer;
  return `${answer}\n\nAnh/chị muốn xem chi phí, bác sĩ hay đặt lịch khám?`;
}

async function updateSessionSummary(
  session: ChatSession,
  intent: Record<string, unknown>,
  action: Record<string, unknown> | null,
) {
  try {
    const recentMessages = await getRecentMessages(session.id, 6);
    const summary = await generateSessionSummary({
      previousSummary: getString(session.context.session_summary),
      recentMessages,
      currentFlow: session.currentFlow,
      currentState: session.currentState,
      context: session.context,
      intent,
      action,
    });

    if (!summary) return session;
    return updateSession(session.id, {
      currentFlow: session.currentFlow,
      currentState: session.currentState,
      context: { ...session.context, session_summary: summary },
    });
  } catch (error) {
    console.warn("Failed to update session summary", error);
    return session;
  }
}

async function buildSessionQuestion(session: ChatSession, message: string) {
  const recentMessages = await getRecentMessages(session.id, 5);
  const stateBlock = formatSessionState(session);
  const historyBlock = formatRecentMessages(recentMessages);
  return `${stateBlock}\n\n${historyBlock}\n\nCurrent user question:\n${message}`;
}

function formatSessionState(session: ChatSession) {
  return [
    "Conversation State:",
    `Current Flow: ${session.currentFlow ?? "none"}`,
    `Current State: ${session.currentState ?? "none"}`,
    `Session Summary: ${getString(session.context.session_summary) ?? "none"}`,
    `Known Information: ${JSON.stringify(session.context)}`,
  ].join("\n");
}

function formatRecentMessages(messages: ChatMessage[]) {
  if (!messages.length) return "Recent Conversation: none";
  return [
    "Recent Conversation:",
    ...messages.map((message) => `${message.role}: ${message.content}`),
  ].join("\n");
}

function isSessionRecallQuestion(message: string): boolean {
  const text = message.toLowerCase();
  return [
    "câu hỏi trước",
    "cau hoi truoc",
    "tôi vừa hỏi gì",
    "toi vua hoi gi",
    "tôi đã hỏi gì",
    "toi da hoi gi",
    "tin nhắn trước",
    "tin nhan truoc",
    "nội dung trước",
    "noi dung truoc",
  ].some((phrase) => text.includes(phrase));
}

function toChatResponse(
  session: ChatSession,
  intent: Record<string, unknown>,
  responseText: string,
  action: Record<string, unknown> | null,
) {
  return {
    session: {
      id: session.id,
      status: session.status,
      currentFlow: session.currentFlow,
      currentState: session.currentState,
      context: session.context,
    },
    intent,
    response: responseText,
    action,
  };
}

async function logChat(
  sessionId: string,
  userMessage: string,
  detectedIntent: string,
  confidence: number,
  responseText: string,
) {
  await pool.query(
    `INSERT INTO chat_logs (session_id, user_message, detected_intent, confidence, response_text)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, userMessage, detectedIntent, confidence, responseText],
  );
}

function extractDepartment(message: string): string | null {
  const trimmed = message.trim();
  if (/tim mạch/i.test(trimmed)) return "Tim mạch";
  if (/(^|\s)nhi(\s|$)/i.test(trimmed)) return "Nhi";
  if (/(^|\s)sản(\s|$)/i.test(trimmed)) return "Sản";
  if (/da liễu/i.test(trimmed)) return "Da liễu";
  if (/tai mũi họng/i.test(trimmed)) return "Tai mũi họng";
  const match = trimmed.match(/khoa\s+([^\d,.;?]+)/i);
  if (match?.[1]) return normalizeSlot(match[1]);
  return null;
}

function extractService(message: string): string | null {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes("siêu âm tim")) return "Siêu âm tim";
  if (lower.includes("khám tim") || lower.includes("khám tim mạch")) return "Khám Tim mạch";
  const match = trimmed.match(/(?:giá|chi phí)\s+(.+?)(?:\s+bao nhiêu|\?|$)/i);
  if (!match?.[1]) return null;
  const service = normalizeSlot(match[1]);
  return ["khám", "dịch vụ", "bao nhiêu"].includes(service.toLowerCase()) ? null : service;
}

function extractUserLocation(message: string): string | null {
  const match = message.trim().match(/(?:tôi ở|toi o|mình ở|minh o|ở)\s+(.+)/i);
  return match?.[1] ? normalizeSlot(match[1].split(/[,.?]/)[0] ?? match[1]) : null;
}

function extractDestination(message: string): string | null {
  const roomMatch = message.match(/phòng\s*\d+/i);
  if (roomMatch?.[0]) return normalizeSlot(roomMatch[0].replace(/^phòng/i, "Phòng"));
  if (/phòng khám tim|phong kham tim/i.test(message)) return "Khoa Tim mạch";
  const department = extractDepartment(message);
  if (department) return `Khoa ${department}`;
  if (message.toLowerCase().includes("cấp cứu")) return "Khoa Cấp cứu";
  return null;
}

function departmentFromDestination(destination: string | null): string | null {
  if (!destination) return null;
  const lower = destination.toLowerCase();
  if (lower.includes("tim mạch") || lower.includes("phòng khám tim") || lower.includes("phong kham tim")) {
    return "Tim mạch";
  }
  return extractDepartment(destination);
}

function extractOrigin(message: string): string | null {
  const lower = message.toLowerCase();
  if (["đúng", "dung", "cổng chính", "cong chinh"].some((word) => lower.includes(word))) return "Cổng chính";
  if (lower.includes("quầy")) return "Quầy tiếp đón";
  return extractUserLocation(message);
}

function extractDate(message: string): string | null {
  const trimmed = message.trim();
  const dateMatch = trimmed.match(/\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/);
  if (dateMatch?.[1]) return dateMatch[1];
  const lower = trimmed.toLowerCase();
  for (const word of ["hôm nay", "ngày mai", "thứ hai", "thứ ba", "thứ tư", "thứ năm", "thứ sáu", "thứ bảy", "chủ nhật"]) {
    if (lower.includes(word)) return word;
  }
  return null;
}

function extractTime(message: string): string | null {
  const trimmed = message.trim();
  const timeMatch = trimmed.match(/\b(\d{1,2}(?::\d{2}|\s*(?:h|giờ))(?:(?:\d{2})?)?)\b/i);
  if (timeMatch?.[1]) return normalizeSlot(timeMatch[1]);
  const lower = trimmed.toLowerCase();
  for (const word of ["buổi sáng", "sáng", "buổi chiều", "chiều", "buổi tối", "tối"]) {
    if (lower.includes(word)) return word;
  }
  return null;
}

function extractSymptom(message: string): string | null {
  const lower = message.toLowerCase();
  const symptoms = ["đau ngực", "khó thở", "sốt", "đau bụng", "chóng mặt", "mệt"];
  const found = symptoms.filter((symptom) => lower.includes(symptom));
  return found.length ? found.join(", ") : null;
}

function extractPatientName(message: string, contact?: { phone?: string | null; email?: string | null }): string | null {
  const explicit = message.trim().match(/(?:tên tôi là|tôi tên là|mình tên là|tên là|họ tên là|ho ten la)\s+(.+)/i);
  if (explicit?.[1]) return cleanupPatientName(explicit[1], contact);
  if (!contact?.phone && !contact?.email && !extractPhone(message) && !extractEmail(message)) return null;
  const rawName = explicit?.[1] ?? inferPatientNameFromContactMessage(message, contact);
  return rawName ? cleanupPatientName(rawName, contact) : null;
}

function extractPhone(message: string): string | null {
  const match = message.match(/(?:\+?84|0)\d{8,10}/);
  return match?.[0] ?? null;
}

function extractEmail(message: string): string | null {
  const match = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? null;
}

function inferPatientNameFromContactMessage(message: string, contact?: { phone?: string | null; email?: string | null }): string | null {
  let candidate = message.trim();
  const phone = contact?.phone ?? extractPhone(message);
  const email = contact?.email ?? extractEmail(message);

  if (phone) candidate = candidate.replace(phone, " ");
  if (email) candidate = candidate.replace(email, " ");

  candidate = candidate
    .replace(/(?:số điện thoại|sdt|sđt|phone|email|mail|liên hệ|lien he|của tôi là|cua toi la|là|la)\s*[:：-]?/gi, " ")
    .replace(/[<>()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || /\d/.test(candidate)) return null;
  if (normalizeText(candidate).split(" ").length < 2) return null;
  return candidate;
}

function cleanupPatientName(value: string, contact?: { phone?: string | null; email?: string | null }): string | null {
  let candidate = value;
  const phone = contact?.phone ?? extractPhone(value);
  const email = contact?.email ?? extractEmail(value);

  if (phone) candidate = candidate.replace(phone, " ");
  if (email) candidate = candidate.replace(email, " ");

  candidate = candidate
    .replace(/(?:số điện thoại|sdt|sđt|phone|email|mail|liên hệ|lien he)\s*[:：-]?/gi, " ")
    .replace(/[<>()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || /\d/.test(candidate)) return null;
  return normalizeSlot(candidate);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoPreference(message: string): boolean {
  const text = normalizeText(message);
  return ["khong", "khong can", "khong yeu cau", "bac si nao cung duoc"].some((phrase) => text.includes(phrase));
}

function normalizeSlot(value: string): string {
  return value.trim().replace(/[.,;]+$/, "");
}

function isInsuranceInquiry(message: string, intent?: Record<string, unknown>): boolean {
  const text = normalizeText([
    message,
    getString(intent?.flow),
    getString(intent?.action),
    getString((intent?.entities as Record<string, unknown> | undefined)?.topic),
    getString((intent?.entities as Record<string, unknown> | undefined)?.inquiry_type),
  ].filter(Boolean).join(" "));

  return [
    "bhyt",
    "insurance inquiry",
    "transfer policy",
    "bao hiem",
    "bao hiem y te",
    "giay chuyen tuyen",
    "giay chuyen vien",
    "phieu chuyen vien",
    "phieu chuyen tuyen",
    "chuyen tuyen",
    "chuyen vien",
    "dung tuyen",
    "don thuoc",
    "dong chi tra",
  ].some((word) => text.includes(word));
}

function selectInsuranceTool(message: string): string {
  const text = normalizeText(message);
  if (
    [
      "don thuoc",
      "mang gi",
      "tai kham",
      "giay to",
      "cccd",
      "chuyen tuyen",
      "chuyen vien",
      "giay chuyen tuyen",
      "giay chuyen vien",
      "phieu chuyen vien",
      "phieu chuyen tuyen",
    ].some((word) => text.includes(word))
  ) {
    return "search_faq";
  }
  return "search_policy";
}

function addInsuranceFollowUp(answer: string, message: string): string {
  const question =
    "Anh/chị muốn hỏi cụ thể về thủ tục khám BHYT, giấy chuyển tuyến, đơn thuốc, tái khám hay chi phí đồng chi trả?";
  const cleanedAnswer = answer
    .replace(/^Tôi chưa có thông tin[^\n]*(?:\n\n)?/i, "")
    .replace(/^Tuy nhiên,\s*/i, "")
    .trim();

  if (!cleanedAnswer) {
    return `Tôi chưa rõ anh/chị cần tư vấn phần nào về BHYT. ${question}`;
  }

  if (!isBroadInsuranceQuestion(message)) return cleanedAnswer;
  return `${cleanedAnswer}\n\n${question}`;
}

function isBroadInsuranceQuestion(message: string): boolean {
  const text = normalizeText(message);
  const hasInsurance = ["bhyt", "bao hiem", "bao hiem y te"].some((word) => text.includes(word));
  const hasSpecificTopic = [
    "thu tuc",
    "giay chuyen tuyen",
    "giay chuyen vien",
    "dung tuyen",
    "trai tuyen",
    "chuyen tuyen",
    "chuyen vien",
    "phieu chuyen vien",
    "phieu chuyen tuyen",
    "don thuoc",
    "tai kham",
    "mang gi",
    "cccd",
    "chi phi",
    "dong chi tra",
  ].some((word) => text.includes(word));
  return hasInsurance && !hasSpecificTopic;
}

function selectHospitalTool(message: string): string {
  const text = message.toLowerCase();
  if (isInsuranceInquiry(message)) return selectInsuranceTool(message);
  if (["dịch vụ", "danh sách dịch vụ"].some((word) => text.includes(word))) return "search_service";
  if (["giá", "chi phí", "bao nhiêu tiền"].some((word) => text.includes(word))) return "search_price";
  if (["ở đâu", "tầng", "phòng", "khoa"].some((word) => text.includes(word))) return "search_navigation";
  if (["mang gì", "chuẩn bị", "giấy tờ"].some((word) => text.includes(word))) return "search_preparation";
  if (["quy trình", "thủ tục", "bước"].some((word) => text.includes(word))) return "search_process";
  if (isAppointmentGuidanceQuestion(message) || ["quy trình", "thủ tục", "bước"].some((word) => text.includes(word))) {
    return "search_policy";
  }
  if (["ticket", "hồ sơ", "kết quả xét nghiệm"].some((word) => text.includes(word))) return "search_ticket_rules";
  return "search_knowledge";
}

function isAppointmentGuidanceQuestion(message: string): boolean {
  const text = message.toLowerCase();
  const appointmentWords = ["đăng ký khám", "đặt lịch", "lịch khám", "hẹn khám"];
  const guidanceWords = [
    "chỉ dẫn",
    "hướng dẫn",
    "quy trình",
    "thủ tục",
    "các bước",
    "cách đăng ký",
    "làm sao đăng ký",
    "làm thế nào đăng ký",
    "liên hệ đặt lịch",
    "hotline",
  ];

  return appointmentWords.some((word) => text.includes(word)) && guidanceWords.some((word) => text.includes(word));
}

const port = Number(process.env.CHATBOT_PORT ?? 3000);

app.listen({ host: "0.0.0.0", port }).catch(async (error) => {
  app.log.error(error);
  await closePool();
  process.exit(1);
});
