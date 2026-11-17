// Recorded narration for each journey stop: stop id -> audio file URL.
// Leave a stop out and the browser reads its `speech` text aloud instead (Web Speech API).
// To use your own recordings, add entries like:  launch: '/audio/launch.mp3'
export const journeyVoices: Record<string, string> = {}
