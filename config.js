// ---------------------------------------------------------------------------
// Edit this file to customise the poll.
//
// Leave supabaseUrl / supabaseAnonKey empty to run in DEMO MODE
// (votes are only stored in your own browser — handy for previewing).
// ---------------------------------------------------------------------------
window.VOTE_CONFIG = {
  title: "Have your say",
  question: "Pick your top 3, in order of preference.",
  intro:
    "Tap an option to rank it. Your first tap is your #1 choice, then #2, then #3. Tap a ranked option again to remove it.",

  // From Supabase: Project Settings → API
  supabaseUrl: "",      // e.g. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",  // the "anon" / "publishable" key (safe to expose)

  // IDs must match the list in supabase/setup.sql (allowed_options).
  options: [
    { id: "option-a", label: "Option A", description: "A short description of option A." },
    { id: "option-b", label: "Option B", description: "A short description of option B." },
    { id: "option-c", label: "Option C", description: "A short description of option C." },
    { id: "option-d", label: "Option D", description: "A short description of option D." },
    { id: "option-e", label: "Option E", description: "A short description of option E." },
  ],
};
