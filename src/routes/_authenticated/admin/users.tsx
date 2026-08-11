import { createFileRoute } from "@tanstack/react-router";
import { UserManagement } from "@/components/user-management";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: () => <UserManagement />,
});
