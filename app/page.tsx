import NavBar from "./components/NavBar";
import VoiceChat from "./components/VoiceChat";

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-white font-sans">
      <NavBar />
      <VoiceChat />
    </div>
  );
}
