import { useState } from "react";
import PasswordInput from "../components/PasswordInput.jsx";
import { ShipWheelIcon } from "lucide-react";
import { Link } from "react-router-dom";

import useSignUp from "../hooks/useSignup.js";

const SignUpPage = () => {
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  // This is how we did it using our custom hook - optimized version
  const { isPending, error, signupMutation } = useSignUp();

  const handleSignup = (e) => {
    e.preventDefault();
    signupMutation(signupData);
  };

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4 sm:p-6 md:p-8 bg-base-200"
      data-theme="forest"
    >
      <div className="border border-primary/20 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-primary/5">
        {/* SIGNUP FORM - LEFT SIDE */}
        <div className="w-full lg:w-1/2 p-6 sm:p-12 flex flex-col justify-center bg-gradient-to-br from-base-100 to-base-200">
          {/* LOGO */}
          <div className="mb-8 flex items-center justify-start gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <ShipWheelIcon className="size-8 text-primary animate-pulse" />
            </div>
            <span className="text-4xl font-black font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_auto] animate-gradient-x tracking-tighter">
              Meetify
            </span>
          </div>

          {/* ERROR MESSAGE IF ANY */}
          {error && (
            <div className="alert alert-error mb-6 shadow-sm border-none bg-error/20 text-error-content rounded-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="font-medium text-sm">{error?.response?.data?.message || "Signup failed. Try again."}</span>
            </div>
          )}

          <div className="w-full">
            <form onSubmit={handleSignup} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-base-content">Create an Account</h2>
                <p className="text-sm text-base-content/60 font-medium">
                  Your people, your conversations. All in one place.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {/* FULLNAME */}
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text font-bold text-xs uppercase tracking-widest opacity-50">Full Name</span>
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="Your Name"
                      className="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all duration-200 rounded-2xl pl-4 border-2 focus:border-primary/50"
                      value={signupData.fullName}
                      onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {/* EMAIL */}
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text font-bold text-xs uppercase tracking-widest opacity-50">Email Address</span>
                  </label>
                  <div className="relative group">
                    <input
                      type="email"
                      placeholder="abc@gmail.com"
                      className="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all duration-200 rounded-2xl pl-4 border-2 focus:border-primary/50"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {/* PASSWORD */}
                <div className="form-control w-full">
                  <label htmlFor="signup-password" className="label py-1">
                    <span className="label-text font-bold text-xs uppercase tracking-widest opacity-50">Password</span>
                  </label>
                  <div className="relative group">
                    <PasswordInput
                      id="signup-password"
                      autoComplete="new-password"
                      minLength={6}
                      placeholder="********"
                      className="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all duration-200 rounded-2xl pl-4 border-2 focus:border-primary/50"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      required
                    />
                  </div>
                  <p className="text-xs opacity-50 mt-1 ml-2">
                    Minimum 6 characters required
                  </p>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3 group">
                    <input type="checkbox" className="checkbox checkbox-primary checkbox-sm rounded-md transition-all group-hover:scale-110" required />
                    <span className="text-xs leading-tight font-medium opacity-70">
                      I agree to the{" "}
                      <span className="text-primary font-bold hover:underline cursor-pointer">Terms</span> and{" "}
                      <span className="text-primary font-bold hover:underline cursor-pointer">Privacy Policy</span>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full rounded-2xl h-14 text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 transform hover:-translate-y-0.5"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <span className="loading loading-spinner loading-md"></span>
                      Registering...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </button>

                <div className="text-center mt-6">
                  <p className="text-sm font-medium opacity-60">
                    Already have an account?{" "}
                    <Link to="/login" className="text-primary font-bold hover:underline transition-all">
                      Sign in
                    </Link>
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* ILLUSTRATION SECTION - RIGHT SIDE */}
        <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/5 items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full -ml-32 -mb-32 blur-3xl animate-pulse"></div>

          <div className="max-w-md p-12 text-center relative z-10">
            {/* Illustration */}
            <div className="relative aspect-square max-w-sm mx-auto mb-10 transform hover:scale-105 transition-transform duration-500">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl"></div>
              <img src="/i.png" alt="Friends connecting on Meetify" className="w-full h-full relative z-10" />
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-bold leading-tight">Join the community</h2>
              <p className="text-base-content/60 font-medium leading-relaxed">
                Find your people, chat in real time, hop on a video call, and share photos and files.
              </p>
            </div>

            <div className="flex justify-center gap-2 mt-8">
              <div className="w-12 h-2 rounded-full bg-primary"></div>
              <div className="w-2 h-2 rounded-full bg-primary/30"></div>
              <div className="w-2 h-2 rounded-full bg-primary/30"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
