import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import "./index.css";

const googleClientId =
	String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim() ||
	"000000000000-placeholder.apps.googleusercontent.com";

createRoot(document.getElementById("root")!).render(
	<GoogleOAuthProvider clientId={googleClientId}>
		<App />
	</GoogleOAuthProvider>,
);
