import { Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  return (
    <AuthLayout
      icon={Mail}
      title="Password reset"
      subtitle="Contact an admin to reset your password"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in
        </Link>
      }
    >
      <p className="text-sm text-foreground text-center">
        Please contact your system administrator to reset your manager password.
      </p>
    </AuthLayout>
  );
}
