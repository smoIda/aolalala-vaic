import { Dropdown } from "@/components/ui/dropdown";

type SubLinkProps = {
  id: string;
  path: string;
};

export type LinkProps = {
  id: string;
  path?: string;
  children?: SubLinkProps[];
};

const links: LinkProps[] = [
  {
    id: "Trang chủ",
    path: "/",
  },

  {
    id: "Giới thiệu",
    children: [
      {
        id: "Giới thiệu chung",

        path: "/",
      },

      {
        id: "Ban lãnh đạo",
        path: "/",
      },

      {
        id: "Cơ cấu tổ chức",
        path: "/",
      },

      {
        id: "Quá trình phát triển",
        path: "/",
      },
    ],
  },

  {
    id: "Dịch vụ",
    children: [
      {
        id: "Khoa khám bệnh tự nguyện",

        path: "/",
      },

      {
        id: "Chăm sóc mạch vành",
        path: "/",
      },

      {
        id: "Khoa dược và hiệu thuốc",
        path: "/",
      },

      {
        id: "Khám sức khỏe cá nhân - tổ chức",
        path: "/",
      },

      {
        id: "Chăm sóc tại nhà",
        path: "/",
      },
    ],
  },

  {
    id: "Hướng dẫn khám bệnh",
    children: [
      {
        id: "Quy trình khám chữa bệnh",
        path: "/",
      },

      {
        id: "Bảng giá dịch vụ",
        path: "/",
      },

      {
        id: "Hướng dẫn liên hệ đặt lịch khám",
        path: "/",
      },

      {
        id: "Lịch làm việc của Bác sỹ",
        path: "/",
      },
    ],
  },

  {
    id: "Phổ biến kiến thức",
    children: [
      {
        id: "Thông tin y học",
        path: "/",
      },

      {
        id: "Hiểu về Tim mạch",
        path: "/",
      },

      {
        id: "Dành cho người bệnh",
        path: "/",
      },

      {
        id: "Kiến thức cho sinh viên Y Khoa",
        path: "/",
      },

      {
        id: "Kiến thức chuyên môn",
        path: "/",
      },
    ],
  },

  {
    id: "Đào tạo - Chỉ đạo tuyến",
    children: [
      {
        id: "Video đào tạo",
        path: "/",
      },

      {
        id: "Đào tạo",
        path: "/",
      },

      {
        id: "Chỉ đạo tuyến",
        path: "/",
      },
    ],
  },

  {
    id: "Quản lý chất lượng",
    path: "/",
  },

  {
    id: "Công tác xã hội",
    children: [
      { id: "Vì một trái tim khỏe", path: "/" },
      { id: "Trái tim nhân ái", path: "/" },
    ],
  },

  {
    id: "Nghiên cứu khoa học",
    children: [
      {
        id: "Bài viết chuyên đề, bài báo khoa học",
        path: "/",
      },

      {
        id: "Đề tài nghiên cứu khoa học, sáng kiến, cải tiến kỹ thuật",
        path: "/",
      },

      {
        id: "Sinh hoạt, hội thảo, hội nghị khoa học",
        path: "/",
      },

      {
        id: "Hội đồng đạo đức trong nghiên cứu khoa học",
        path: "/",
      },
    ],
  },

  {
    id: "Thông báo",
    path: "/",
  },
];

export function Navbar() {
  return (
    <nav className="bg-accent-ink text-white-ink z-50 hidden w-full items-center justify-center xl:flex">
      <ul className="flex w-full items-center justify-center gap-x-4 px-2 *:shrink-0">
        {links.map((link) => (
          <li key={link.id} className="group relative py-2">
            {link.children ? (
              <Dropdown link={link} />
            ) : (
              <a
                className="flex items-center justify-center gap-x-1"
                href={link.path}
              >
                {link.id}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
