import { connection } from "next/server";

const todayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Today's date in Jakarta. Reading the clock is request-time data, so this waits for the request first
// (and is rendered inside a Suspense boundary).
export async function TodayJakarta() {
  await connection();
  return <time dateTime={new Date().toISOString()}>{todayFormat.format(new Date())}</time>;
}
