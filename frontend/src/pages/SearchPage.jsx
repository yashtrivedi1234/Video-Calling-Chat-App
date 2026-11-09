import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { SearchIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { acceptFriendRequest, searchPeople, sendFriendRequest } from "../lib/api.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";

export default function SearchPage() {
  const [value, setValue] = useState("");
  const term = value.trim();
  const query = useDebouncedValue(term);
  const queryClient = useQueryClient();
  const results = useQuery({
    queryKey: ["peopleSearch", query],
    queryFn: ({ signal }) => searchPeople(query, signal),
    enabled: Boolean(query.replace(/^@/, "")), retry: false,
  });
  const mutation = useMutation({
    mutationFn: (person) => person.relationship === "incoming" ? acceptFriendRequest(person.requestId) : sendFriendRequest(person._id),
    onSuccess: (_, person) => {
      toast.success(person.relationship === "incoming" ? "You're connected!" : "Friend request sent!");
      for (const key of ["peopleSearch", "friends", "users", "userFriends", "friendRequests", "outgoingFriendReqs"]) queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Couldn't update this request. Try again.");
      queryClient.invalidateQueries({ queryKey: ["peopleSearch"] });
    },
  });
  const searching = term !== query || results.isLoading;

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10" aria-labelledby="search-title">
      <h1 id="search-title" className="text-3xl font-bold">Search</h1>
      <p className="mt-2 text-sm text-base-content/60">Your next conversation starts here.</p>
      <form role="search" className="relative mt-6" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="people-search" className="sr-only">Search people by name or username</label>
        <SearchIcon className="pointer-events-none absolute left-4 top-3.5 z-10 size-5 text-base-content/50" />
        <input id="people-search" type="search" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={80} className="input input-bordered h-12 w-full rounded-xl bg-base-200 pl-12 pr-12 [&::-webkit-search-cancel-button]:hidden" placeholder="Search by name or @username" value={value} onChange={(event) => setValue(event.target.value)} aria-controls="people-results" />
        {value && <button type="button" aria-label="Clear search" className="btn btn-ghost btn-circle absolute right-1 top-0.5 size-11" onClick={() => { setValue(""); document.getElementById("people-search").focus(); }}><XIcon className="size-4" /></button>}
      </form>
      <div id="people-results" className="mt-6" aria-busy={Boolean(term && searching)}>
        {!term.replace(/^@/, "") ? (
          <div className="py-16 text-center"><SearchIcon className="mx-auto mb-4 size-10 text-base-content/30" /><h2 className="text-lg font-semibold">Find your people</h2><p className="mx-auto mt-2 max-w-xs text-sm text-base-content/60">Look up a friend by their name or unique username to connect.</p></div>
        ) : searching ? (
          <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm"><span className="loading loading-spinner loading-sm" />Searching…</p>
        ) : results.isError ? (
          <div role="alert" className="py-10 text-center"><p>Couldn't load results.</p><button className="btn btn-outline mt-4 min-h-11" onClick={() => results.refetch()}>Try again</button></div>
        ) : results.data?.length ? (
          <>
            <p className="mb-3 text-sm font-semibold text-base-content/60" role="status">People · {results.data.length === 20 ? "Top 20 matches" : `${results.data.length} ${results.data.length === 1 ? "result" : "results"}`}</p>
            <ul className="divide-y divide-base-300">
              {results.data.map((person) => (
                <li key={person._id} className="flex items-center gap-3 py-4">
                  <img src={person.profilePic} alt="" className="size-12 shrink-0 rounded-full bg-base-300 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{person.username ? `@${person.username}` : person.fullName}</p>
                    {person.username && <p className="truncate text-sm text-base-content/60">{person.fullName}</p>}
                    {person.bio && <p className="mt-0.5 line-clamp-1 text-xs text-base-content/50">{person.bio}</p>}
                  </div>
                  {person.relationship === "friend" ? <Link to={`/chat/${person._id}`} className="btn btn-outline min-h-11 shrink-0" aria-label={`Message ${person.fullName}`}>Message</Link> : <button className={`btn min-h-11 shrink-0 ${person.relationship === "outgoing" ? "btn-ghost" : "btn-primary"}`} disabled={mutation.isPending || person.relationship === "outgoing"} onClick={() => mutation.mutate(person)} aria-label={`${person.relationship === "incoming" ? "Accept request from" : person.relationship === "outgoing" ? "Request sent to" : "Connect with"} ${person.fullName}`}>{mutation.isPending && mutation.variables?._id === person._id ? <span className="loading loading-spinner loading-sm" /> : person.relationship === "outgoing" ? "Requested" : person.relationship === "incoming" ? "Accept" : "Connect"}</button>}
                </li>
              ))}
            </ul>
          </>
        ) : <div role="status" className="py-12 text-center"><h2 className="font-semibold">No people found</h2><p className="mt-2 text-sm text-base-content/60">Try a different name or check the username.</p></div>}
      </div>
    </section>
  );
}
