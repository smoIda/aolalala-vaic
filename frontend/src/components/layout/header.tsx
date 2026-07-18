"use client";

import Image from "next/image";
import Link from "next/link";

import { Navbar } from "@/components/layout/navbar";
import { useToggle } from "@/hooks/useToggle";

export function Header() {
  const { isSidebarOpen, setIsSidebarOpen } = useToggle();

  return (
    <header className="z-50 flex w-full flex-col items-center justify-center">
      <div className="flex w-full max-w-270 items-center justify-between px-6 py-2">
        <div className="flex items-center justify-center gap-x-4">
          <Link href="/">
            <Image
              src="/bvtim_logo.png"
              className="h-auto w-full"
              alt=""
              width={70}
              height={70}
            />
          </Link>

          <div className="hidden sm:block">
            <h1 className="text-accent-ink text-2xl font-bold uppercase text-shadow-[1px_1px_1px_#ccc]">
              Bệnh viện Tim Hà Nội
            </h1>

            <p className="text-accent-ink text-xl font-bold text-shadow-[1px_1px_1px_#ccc]">
              Thân thiện - Thuận tiện - Thanh lịch
            </p>
          </div>
        </div>

        <div className="hidden items-center justify-center gap-x-2 xl:flex">
          <button className="cursor-pointer" title="Vietnamese">
            <Image width={30} height={20} src="/flag_vn.png" alt="" />
          </button>

          <button className="cursor-pointer" title="English">
            <Image width={30} height={20} src="/flag_uk.png" alt="" />
          </button>

          <a
            className="text-accent-ink"
            href="https://benhvientimhanoi.vn/he-thong/dang-nhap/index.html"
          >
            Đăng nhập
          </a>
        </div>

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex cursor-pointer xl:hidden"
        >
          <svg className="size-8" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 18L20 18"
              className="stroke-ink"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <path
              d="M4 12L20 12"
              className="stroke-ink"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <path
              d="M4 6L20 6"
              className="stroke-ink"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <Navbar />
    </header>
  );
}
