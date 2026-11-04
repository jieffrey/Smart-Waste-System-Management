import { redirect } from "next/navigation";

// proxy.ts already sends visitors without a session to /login, so "/" only needs to go to the dashboard.
export default function Home() {
  redirect("/dashboard");
}
