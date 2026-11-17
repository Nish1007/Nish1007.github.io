/* ------------------------------------------------------------------
   Project data, keyed by the album each one is "pressed" on.
   Facts come from the GitHub repos (descriptions, READMEs, language
   breakdowns, dates). Edit freely: add a project by adding an entry
   whose key matches an album slug in albums.js.

   track: index of the song that plays (see albums.js), optional.
   private: true  -> no GitHub link is shown.
   ------------------------------------------------------------------ */
window.PROJECTS = {

  'channel-orange': {
    title: 'Build Your Own Kafka',
    kind: 'Distributed systems',
    tagline: 'A Kafka-flavoured distributed commit-log broker, built from scratch in Java.',
    description: 'My own storage engine, binary record format, indexing and replication, with Spring Boot used only as the networking layer around it. It runs as a 3-broker cluster on AWS.',
    facts: [['Repo', 'Public'], ['Last push', 'Sep 2026'], ['Deployed', 'AWS ECS Fargate']],
    langs: [['Java', 87.6], ['HCL', 11.4], ['Dockerfile', 1.0]],
    highlights: [
      'A plain-Java core: Record, RecordCodec, Segment, SegmentIndex, Partition and Topic, with no Spring and no network, so the storage engine can be read on its own.',
      'A Spring Boot broker exposing produce and fetch, topic management, consumer groups (join, poll, commit, with eviction after 30 seconds of silence) and fetch-based follower replication.',
      'A thin Java client (ByokProducer and ByokConsumer) wrapped around the REST API.',
      'Run end to end on AWS: three brokers as ECS Fargate tasks with EFS storage and Cloud Map discovery. Debugging it surfaced two real infrastructure bugs: a missing ECS task role for EFS and a missing self-referencing NFS ingress rule.',
      'Crash-recovery tests prove the record count survives closing and reopening a segment.'
    ],
    stack: ['Java 17', 'Spring Boot', 'Gradle', 'Docker Compose', 'Terraform', 'AWS ECS Fargate', 'EFS', 'Cloud Map'],
    github: 'https://github.com/Nish1007/build-your-own-kafka'
  },

  'modal-soul': {
    title: 'MiniOS',
    kind: 'Operating systems',
    track: 2,
    tagline: 'A hobby x86-64 OS that boots from a 512-byte sector into a 64-bit C++ kernel.',
    description: 'It walks itself from 16-bit real mode all the way up to long mode, with every stage hand-written, and then gives you a live, typeable prompt in QEMU.',
    facts: [['Repo', 'Public'], ['Last push', 'Aug 2026'], ['License', 'MIT']],
    langs: [['Assembly', 37.7], ['C++', 36.4], ['C', 14.5], ['Shell', 8.8], ['Linker Script', 2.5]],
    highlights: [
      'A custom 512-byte boot sector with no bootloader framework.',
      'Real mode to A20 and the BIOS E820 memory map, then protected mode, long mode and the C++ kernel.',
      'Identity-mapped paging with 2MB pages (PML4 to PDPT to PD).',
      'A freestanding C++ kernel: VGA text output with a hardware cursor, an IDT with a keyboard IRQ handler, an E820 parser and a heap allocator (malloc, free, calloc, realloc, aligned_alloc).',
      'Tracked down two bugs in the stage-1 disk loader (a CHS head-rollover off-by-one and a non-standard floppy image size) that were silently corrupting the kernel\'s read-only data.'
    ],
    stack: ['x86-64 Assembly', 'C++', 'C', 'NASM', 'QEMU', 'Bochs'],
    github: 'https://github.com/Nish1007/MiniOS'
  },

  'blonde': {
    title: 'swe-jobs-bot',
    kind: 'Automation',
    private: true,
    tagline: 'A daily job-board scanner that emails only the roles it has not sent before.',
    description: 'It checks the Greenhouse, Lever and Ashby job boards of around 115 UK and European tech, fintech, AI and quant companies, filters by title and location, and sends a digest. It runs on a schedule with GitHub Actions.',
    facts: [['Repo', 'Private'], ['Runs', 'Daily, on GitHub Actions'], ['Started', 'Oct 2026']],
    langs: [['Python', 77.0], ['HTML', 23.0]],
    highlights: [
      'Pulls from three applicant-tracking-system APIs, with optional Adzuna and Reed job-board sources.',
      'Remembers what it has already sent (state committed back to the repo by the workflow), so each email contains only new roles.',
      'Everything is tuned from one config file: keywords, regions, exclusions and the company list.',
      'A dry-run mode prints matches without sending anything, and the script needs nothing beyond the Python standard library.'
    ],
    stack: ['Python', 'GitHub Actions', 'REST APIs', 'SMTP'],
    github: null
  },

  'who-really-cares': {
    title: 'BASIC, in Python',
    kind: 'Programming languages',
    tagline: 'A toy programming language, interpreted, built from scratch.',
    description: 'A hand-written lexer, a recursive-descent parser and a tree-walking interpreter, with no external dependencies. I wrote it in 2020 and uploaded it later.',
    facts: [['Repo', 'Public'], ['Written', '2020'], ['Dependencies', 'None']],
    langs: [['Python', 100]],
    highlights: [
      'Variables, numbers and strings, comparisons and boolean logic, if/elif/else, for and while loops, and lists.',
      'Functions, either multi-line or one-line with an arrow, plus BREAK, CONTINUE and RETURN.',
      'Errors point at the exact text with an arrow under the source line, and runtime errors print a call-stack traceback.',
      'An interactive REPL, and a RUN function to execute script files.'
    ],
    stack: ['Python 3', 'Lexer', 'Recursive-descent parser', 'AST interpreter'],
    github: 'https://github.com/Nish1007/BASIC---mock-programming-Langauge-in-Python'
  },

  'luv-sic': {
    title: 'JPMorgan Chase Simulation',
    kind: 'Virtual experience',
    tagline: 'Three tasks from JPMorgan Chase\'s software-engineering virtual experience on Forage.',
    description: 'Forks of the programme\'s starter repos with my changes: a Python client in the first task, then a React and TypeScript front end that streams price data into a live chart in the next two.',
    facts: [['Repos', 'Public (3)'], ['When', 'Feb to Mar 2023'], ['Programme', 'Forage']],
    langs: [['Python', 66.4], ['TypeScript', 21.3], ['HTML', 7.1], ['CSS', 4.3], ['JavaScript', 0.9]],
    highlights: [
      'Task 1: worked on the Python client from the starter code.',
      'Tasks 2 and 3: edited the React and TypeScript front end, including the Graph component, the data streamer and the data manipulator.',
      'Starter code is provided by the programme, so these repos are forks of those templates.'
    ],
    stack: ['Python', 'TypeScript', 'React', 'HTML / CSS'],
    github: 'https://github.com/Nish1007/jpmc-task-3'
  },

  'grace': {
    title: 'Halatro',
    kind: 'Functional programming',
    private: true,
    tagline: 'Poker-hand scoring and card-playing AIs for a Balatro-style game, in Haskell.',
    description: 'University coursework. The module supplied the game engine and the terminal UI; my part is the logic behind them: recognising poker hands, working out which cards score, finding the best hand in any set of cards, and an AI that decides when to play and when to discard.',
    facts: [['Repo', 'Private'], ['Written', 'Feb 2025'], ['Context', 'University coursework']],
    langs: [['Haskell', 100]],
    highlights: [
      'Recognises every hand type from a pair up to a royal flush, built from small reusable helpers for group sizes, straights and flushes.',
      'Works out which cards actually score for each hand type, then applies the game\'s chips-times-multiplier formula.',
      'Finds the highest-scoring hand of one to five cards by scoring every possible subset of the cards and keeping the best.',
      'Three AIs of increasing strength: play the five highest cards; always play the best-scoring hand; and one that tracks its past moves and discards low cards when its best hand scores under 100 and it still has discards left.'
    ],
    stack: ['Haskell', 'GHC2021', 'Stack', 'Cabal'],
    github: null
  },

  'son-of-spergy': {
    title: 'Vinted Deal Bot',
    kind: 'Automation',
    tagline: 'A config-driven Vinted UK deal finder that ranks listings by how far under retail they are, with a fake-risk rating.',
    description: 'Point it at what you want in a YAML file and it searches Vinted UK, keeps only listings in your size from reviewed private sellers, and writes an HTML report with photos and links. Swapping what it hunts for never needs a code change.',
    facts: [['Repo', 'Public'], ['Started', 'Nov 2026'], ['Interface', 'Command line']],
    langs: [['Python', 100]],
    highlights: [
      'Two kinds of hunt: retail-ratio (designer pieces at 20% of retail or less) and style (keywords, a size and a price cap).',
      'Rates each retail-ratio deal LOW, MEDIUM or HIGH for fake or scam risk, from how cheap it is, seller review count, photo count, description quality and authenticity wording.',
      'Fetches pages with a browser-like TLS fingerprint (curl_cffi), decodes the listing data embedded in the page, and opens each candidate to check the seller. It waits a random few seconds between requests and backs off on 429 and 403 responses.',
      'Remembers what it has already shown you in a local SQLite database, so repeat runs mark listings as NEW or PRICE DROP, and a watch mode can send Discord or ntfy alerts.',
      'Read-only by design: it only reads public listing pages and never logs in, buys or messages anyone.',
      '113 offline tests (the Vinted client is faked) cover matching, every fake-risk rule, the back-off behaviour, whole hunts, NEW and PRICE DROP tracking and the real config file, and run on GitHub Actions.',
      'Set up for Claude Code: a CLAUDE.md with the rules the bot must keep (read-only, polite, no secrets), three subagents for writing tests, reviewing changes and editing the config, and permissions that ask before anything contacts Vinted.'
    ],
    stack: ['Python', 'curl_cffi', 'YAML', 'SQLite', 'pytest', 'GitHub Actions', 'Claude Code'],
    github: 'https://github.com/Nish1007/vinted-deal-bot'
  },

  'another-one': {
    title: 'Speech Recognition',
    kind: 'Speech & audio',
    tagline: 'An offline speech-to-text tool: transcribe audio files, make subtitles, or caption your microphone live, with no internet.',
    description: 'Recognition runs on Vosk (Kaldi) models on your own machine, with no account, API key or cloud. The command-line tool around it is mine: audio conversion, word-timed subtitles and a live caption mode.',
    facts: [['Repo', 'Public'], ['Built', 'Nov 2026'], ['Runs', 'Fully offline']],
    langs: [['Python', 100]],
    highlights: [
      'Three commands: file (a transcript, plus optional SRT subtitles and a text file), live (captions from the microphone as you talk) and devices (list microphones).',
      'Reads any 16-bit WAV, mono or stereo at any sample rate, and converts it to the 16 kHz mono the model expects.',
      'Subtitles use the word-level timings from the recogniser and split long sentences into short, readable cues.',
      'Live mode streams the microphone from the audio thread into a queue, showing partial words as they form and a timestamped line for each finished sentence.',
      'Unit tests cover the audio conversion and subtitle formatting, and a silence check runs against the real model. A Dockerfile transcribes files in a container.'
    ],
    stack: ['Python 3', 'Vosk (Kaldi)', 'NumPy', 'sounddevice', 'pytest', 'Docker'],
    github: 'https://github.com/Nish1007/speech-recognition'
  },

  'the-blue-album': {
    title: 'Face Recognition',
    kind: 'Computer vision',
    tagline: 'A live webcam check that tells you whether the face in front of the camera is the person in a reference photo.',
    description: 'The face model is DeepFace; the video loop, threading and on-screen verdict are mine. It started as a short script in 2023, and I reworked it in 2026 so the video never freezes while it thinks.',
    facts: [['Repo', 'Public'], ['Started', '2023'], ['Reworked', 'Nov 2026']],
    langs: [['Python', 100]],
    highlights: [
      'A green MATCH, red NO MATCH or amber NO FACE overlay on the live camera feed, with the measured distance beside the threshold it is judged against.',
      'Each check takes longer than a video frame, so it runs on a background thread behind a lock that allows only one check at a time; frames that arrive meanwhile are skipped. The original version started a new thread every 30 frames and could pile them up.',
      'No face in view is reported as NO FACE rather than a misleading NO MATCH, and bad cameras or a missing reference photo give a clear message instead of a crash.',
      'Command-line options for the camera, model and detector, plus an --image mode that checks a single photo without a webcam.',
      'The reference photo is git-ignored, since it is a photo of a real person, and the tests use a stand-in for DeepFace so they run instantly.'
    ],
    stack: ['Python 3', 'DeepFace', 'OpenCV', 'TensorFlow', 'pytest'],
    github: 'https://github.com/Nish1007/face-recognition'
  }
};
