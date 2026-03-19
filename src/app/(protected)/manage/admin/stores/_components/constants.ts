export const PAGE_SIZE = 20;

export const REGISTRATION_METHOD_OPTIONS: {
  value: "all" | "direct" | "auto";
  label: string;
}[] = [
  { value: "all", label: "전체" },
  { value: "direct", label: "수동" },
  { value: "auto", label: "자동" },
];
