import { redirect } from "next/navigation";

import { rawEdition } from "../lib/fixture";

export default function Home() {
  // The front page is the current issue (V2 §2.2); no archive until V4.
  redirect(`/${rawEdition.id}`);
}
