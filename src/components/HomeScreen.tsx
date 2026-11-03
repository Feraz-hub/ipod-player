import { Smartphone, Share, PlusSquare } from "lucide-react";

export default function HomeScreen() {
  return (
    <div className="home-screen-help">
      <h3>
        <Smartphone size={18} /> On your iPhone
      </h3>
      <ol>
        <li>
          Open this player’s link in <strong>Safari</strong>.
        </li>
        <li>
          Tap <Share size={14} aria-hidden="true" /> <strong>Share</strong>,
          then <PlusSquare size={14} aria-hidden="true" />{" "}
          <strong>Add to Home Screen</strong>.
        </li>
        <li>
          Keep <strong>Open as Web App</strong> on if shown, then tap{" "}
          <strong>Add</strong>.
        </li>
      </ol>
      <p className="small muted">
        Open the Nightshift icon to listen. The interface and device imports
        work offline after the first online visit. Account music and internet
        clips need a connection.
      </p>
      <p className="small muted">
        Sign in with the same account on your laptop and Home Screen app to see
        your private uploads on both. Device-only imports stay in their own
        browser and do not sync.
      </p>
    </div>
  );
}
