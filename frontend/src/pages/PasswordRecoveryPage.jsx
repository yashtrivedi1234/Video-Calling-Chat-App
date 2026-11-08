import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { ShipWheelIcon } from "lucide-react";
import { forgotPassword, resetPassword } from "../lib/api.js";
import PasswordInput from "../components/PasswordInput.jsx";
import { clearBrowserPush } from "../lib/push.js";

export default function PasswordRecoveryPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const isReset = location.pathname === "/reset-password";
  const token = location.hash.slice(1);
  const invalidLink = isReset && !/^[a-f0-9]{64}$/.test(token);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const { mutate, isPending, isSuccess, data, error } = useMutation({
    mutationFn: () => isReset ? resetPassword({ token, password }) : forgotPassword(email.trim()),
    onSuccess: async () => {
      if (isReset) {
        await clearBrowserPush().catch(() => {});
        await queryClient.cancelQueries();
        queryClient.setQueryData(["authUser"], { user: null });
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "authUser" });
        setPassword("");
        setConfirmPassword("");
      }
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError("");
    if (isReset && password !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }
    mutate();
  };

  const errorMessage = validationError || error?.response?.data?.message || (error && "Something went wrong. Please try again.");

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4 sm:p-8" data-theme="forest">
      <div className="w-full max-w-md rounded-3xl border border-primary/20 bg-base-100 p-6 shadow-2xl sm:p-10">
        <Link to="/login" className="mb-8 flex items-center gap-3 text-primary">
          <ShipWheelIcon className="size-8" aria-hidden="true" />
          <span className="font-mono text-3xl font-black">Meetify</span>
        </Link>
        <h1 className="text-2xl font-bold">{isReset ? "Choose a new password" : "Forgot your password?"}</h1>
        <p className="mt-2 mb-6 text-sm text-base-content/60">
          {isReset ? "Set a new password to get back to your conversations." : "Enter your account email and we’ll send you a reset link."}
        </p>

        {invalidLink ? (
          <div className="alert alert-error" role="alert">This reset link is invalid. Request a new link below.</div>
        ) : isSuccess ? (
          <div className="alert alert-success" role="status">{data.message}</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && <div className="alert alert-error text-sm" role="alert">{errorMessage}</div>}
            {isReset ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="new-password" className="block text-sm font-semibold">New password</label>
                  <PasswordInput id="new-password" autoComplete="new-password" minLength={6} maxLength={72} required
                    className="input input-bordered w-full rounded-2xl" value={password} onChange={(event) => setPassword(event.target.value)}
                    aria-describedby="password-help" />
                  <p id="password-help" className="text-xs text-base-content/60">Use at least 6 characters.</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirm-password" className="block text-sm font-semibold">Confirm new password</label>
                  <PasswordInput id="confirm-password" autoComplete="new-password" minLength={6} maxLength={72} required
                    className="input input-bordered w-full rounded-2xl" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label htmlFor="recovery-email" className="block text-sm font-semibold">Email address</label>
                <input id="recovery-email" type="email" autoComplete="email" maxLength={254} required
                  className="input input-bordered w-full rounded-2xl" placeholder="hello@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            )}
            <button type="submit" disabled={isPending} className="btn btn-primary w-full rounded-2xl">
              {isPending && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
              {isPending ? "Please wait…" : isReset ? "Reset password" : "Send reset link"}
            </button>
          </form>
        )}

        {!isReset && isSuccess && <p className="mt-4 text-sm text-base-content/60">Links expire after 15 minutes. Please wait a minute before requesting another.</p>}
        <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
          <Link to="/login" className="link link-primary font-semibold">Back to sign in</Link>
          {isReset && !isSuccess && <Link to="/forgot-password" className="link link-primary">Request a new link</Link>}
        </div>
      </div>
    </div>
  );
}
