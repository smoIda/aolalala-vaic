import { LinkProps } from "@/components/layout/navbar";

type DropdownProps = {
  link: LinkProps;
};

export function Dropdown({ link }: DropdownProps) {
  return (
    <>
      <div className="flex items-center justify-center gap-x-1">
        <button className="cursor-pointer">{link.id}</button>

        <svg className="fill-white-ink size-3" viewBox="0 0 512 512">
          <path d="M98,190.06,237.78,353.18a24,24,0,0,0,36.44,0L414,190.06c13.34-15.57,2.28-39.62-18.22-39.62H116.18C95.68,150.44,84.62,174.49,98,190.06Z"></path>
        </svg>
      </div>

      <ul className="bg-white-ink pointer-events-none absolute top-full mt-4 -translate-y-1 space-y-4 rounded-md p-6 text-nowrap opacity-0 transition-[opacity,top] duration-250 select-none group-hover:pointer-events-auto group-hover:top-6 group-hover:opacity-100 peer-hover:translate-y-0">
        {link.children?.map((c) => {
          return (
            <li key={c.id}>
              <a
                href={c.path}
                className="hover:text-link-ink-hover text-link-ink font-semibold"
              >
                {c.id}
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
