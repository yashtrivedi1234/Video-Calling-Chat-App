import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, AtSignIcon, CheckIcon, FileUpIcon, MessageCircleIcon, ShipWheelIcon, ShuffleIcon, VideoIcon } from "lucide-react";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import { checkUsername, completeOnboarding } from "../lib/api.js";

export default function OnboardingPage() {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: authUser?.fullName || "", username: authUser?.username || "",
    bio: authUser?.bio || "", location: authUser?.location || "", profilePic: authUser?.profilePic || "",
  });
  const username = form.username.trim().toLowerCase();
  const debounced = useDebouncedValue(username);
  const validUsername = /^[a-z0-9._]{3,30}$/.test(username);
  const availability = useQuery({
    queryKey: ["username", debounced],
    queryFn: ({ signal }) => checkUsername(debounced, signal),
    enabled: /^[a-z0-9._]{3,30}$/.test(debounced), retry: false,
  });
  const checking = validUsername && (username !== debounced || availability.isFetching);
  const available = validUsername && username === debounced && availability.data?.available;
  const mutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: (data) => {
      queryClient.setQueryData(["authUser"], { user: data.user });
      toast.success("You're all set. Welcome to Meetify!");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Couldn't save your profile. Try again.");
      queryClient.invalidateQueries({ queryKey: ["username", debounced] });
    },
  });
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  return (
    <main className="min-h-dvh bg-base-100 px-4 py-8 sm:px-8 lg:flex lg:items-center lg:py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-2 lg:gap-16 lg:items-center">
        <section>
          <div className="mb-8 flex items-center gap-2 text-primary"><ShipWheelIcon className="size-8" /><span className="text-2xl font-bold">Meetify</span></div>
          <p className="mb-3 text-sm font-semibold text-primary">YOUR PEOPLE. ONE PLACE.</p>
          <h1 className="max-w-md text-4xl font-bold leading-tight sm:text-5xl">Good conversations start with you.</h1>
          <p className="mt-4 max-w-md text-base-content/70">Find your friends, meet new people, and keep every conversation close.</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="flex items-center gap-3"><MessageCircleIcon className="size-5 shrink-0 text-primary" /><div><h2 className="font-semibold">Chat your way</h2><p className="text-sm text-base-content/60">Messages, reactions and real connections.</p></div></div>
            <div className="flex items-center gap-3"><VideoIcon className="size-5 shrink-0 text-primary" /><div><h2 className="font-semibold">Get face to face</h2><p className="text-sm text-base-content/60">Video calls that bring you closer.</p></div></div>
            <div className="flex items-center gap-3"><FileUpIcon className="size-5 shrink-0 text-primary" /><div><h2 className="font-semibold">Share the everyday</h2><p className="text-sm text-base-content/60">Send photos, documents and files in chat.</p></div></div>
          </div>
        </section>
        <section className="min-w-0 rounded-3xl border border-base-300 bg-base-200 p-5 sm:p-8" aria-labelledby="profile-title">
          <h2 id="profile-title" className="text-2xl font-bold">Make it yours</h2>
          <p className="mt-1 text-sm text-base-content/60">{authUser?.isOnboarded ? "Choose a username so friends can find you. Your profile and connections stay with you." : "Pick a username and introduce yourself."}</p>
          <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); if (available) mutation.mutate({ ...form, username }); }}>
            <div className="flex items-center gap-4">
              <img src={form.profilePic} alt="Your profile avatar" className="size-16 rounded-full bg-base-300 object-cover" />
              <button type="button" disabled={mutation.isPending} className="btn btn-outline min-h-11" onClick={() => setForm({ ...form, profilePic: `https://api.dicebear.com/9.x/avataaars/svg?seed=${crypto.randomUUID()}` })}><ShuffleIcon className="size-4" />Change avatar</button>
            </div>
            <div>
              <label htmlFor="profile-name" className="mb-1 block text-sm font-medium">Full name</label>
              <input id="profile-name" name="fullName" autoComplete="name" className="input input-bordered w-full" required maxLength={80} value={form.fullName} onChange={change} disabled={mutation.isPending} />
            </div>
            <div>
              <label htmlFor="profile-username" className="mb-1 block text-sm font-medium">Username</label>
              <div className="relative"><AtSignIcon className="pointer-events-none absolute left-3 top-3 z-10 size-5 text-base-content/50" /><input id="profile-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} className="input input-bordered w-full pl-10" placeholder="your.username" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9._]{3,30}" value={form.username} onChange={change} disabled={mutation.isPending} aria-describedby="username-help username-status" aria-invalid={Boolean(username && !validUsername)} /></div>
              <p id="username-help" className="mt-1 text-xs text-base-content/60">3–30 letters, numbers, dots or underscores. No spaces.</p>
              <div id="username-status" className="mt-1 min-h-5 text-sm" role="status" aria-live="polite">
                {checking ? "Checking username…" : available ? <span className="inline-flex items-center gap-1 text-success"><CheckIcon className="size-4" />@{username} is available</span> : validUsername && username === debounced && availability.isError ? <button type="button" className="link text-error" onClick={() => availability.refetch()}>Couldn't check. Try again</button> : validUsername && username === debounced && availability.data?.available === false ? <span className="text-error">Already taken. Try another username.</span> : null}
              </div>
            </div>
            <div>
              <label htmlFor="profile-bio" className="mb-1 block text-sm font-medium">Bio <span className="font-normal text-base-content/50">· optional</span></label>
              <textarea id="profile-bio" name="bio" className="textarea textarea-bordered min-h-20 w-full" maxLength={240} placeholder="A little about you, your interests, your world…" value={form.bio} onChange={change} disabled={mutation.isPending} />
            </div>
            <div>
              <label htmlFor="profile-location" className="mb-1 block text-sm font-medium">Location <span className="font-normal text-base-content/50">· optional, visible on your profile</span></label>
              <input id="profile-location" name="location" autoComplete="address-level2" className="input input-bordered w-full" placeholder="City, country" maxLength={100} value={form.location} onChange={change} disabled={mutation.isPending} />
            </div>
            <button type="submit" className="btn btn-primary min-h-12 w-full" disabled={mutation.isPending || !available || checking}>{mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : <>Let's connect<ArrowRightIcon className="size-4" /></>}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
