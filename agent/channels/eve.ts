import { eveChannel } from "eve/channels/eve";
import { auth } from "@/auth";
import { createEveSecurity } from "../lib/eve-security";

const security = createEveSecurity({
  getSession: (headers) => auth.api.getSession({ headers }),
});

export default eveChannel({
  auth: security.auth,
  events: security.events,
  uploadPolicy: "disabled",
});
