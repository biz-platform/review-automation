import { ManageLayoutClient } from "./ManageLayoutClient";

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ManageLayoutClient>{children}</ManageLayoutClient>;
}
