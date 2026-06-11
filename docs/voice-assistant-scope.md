# Voice Assistant Question Scope

## Purpose

The CNSL voice assistant should answer a deliberately small set of useful pool, team, and meet questions from published seasonal data already available to the PWA. It is not a general chatbot and it must not depend on an external AI service to interpret or compose answers.

The experience should work from typed questions first and allow speech as an input and output mode when the user's browser and privacy choices permit it.

This is a future design scope, not a currently delivered feature. Earlier unpublished search and speech prototypes were removed from the shipped source tree so a future implementation begins from these reviewed requirements and receives full accessibility and privacy testing.

## Product Principles

- Answer deterministically from the active season data and device-local preferences.
- Treat `my` and `favorite` as references to explicitly saved settings, never guesses.
- State the published schedule basis when an answer could be mistaken for live operational status.
- Request location only for a question that needs proximity and do not save coordinates.
- Always make an answer readable on screen; speech is an enhancement, not the only path.
- Keep voice initiation user controlled with a press-to-talk action and a clear listening state.

## Existing Foundation

| Area | Available today | Implication for renewed voice work |
| --- | --- | --- |
| Speech helper | No shipped speech-recognition helper. | Introduce recognition only after its accessibility and privacy behavior is deliberately verified. |
| Search UI | No shipped question-and-answer control. | A future screen-first response region must be implemented as a supported public workflow. |
| Search routing | No shipped natural-language routing engine. | A future deterministic resolver must be based on the supported intent and data rules below. |
| Preferences | [`preferences-service.js`](../src/js/services/preferences-service.js) stores `favoriteTeamId` and `favoritePoolName` in browser storage. | `my team` and `my pool` can resolve locally when the user has made a selection. |
| Pools | The active pool schema includes coordinates, published schedules and overrides, and amenity strings such as `slide`, `beach entry`, `pool lift`, and `wading`. | Pool status, location, nearby ranking, and amenity questions are supportable from local data. |
| Teams | The active team schema includes team aliases, practice pools, and optional detailed practice schedules. | Practice answers can target a named team or the saved favorite when schedule details are present. |
| Meets | The active meet schema includes dates, regular meet opponents and locations, and special meets. | Upcoming meet and favorite-team matchup answers are supportable. |

## Important Constraints To Resolve

- A browser `SpeechRecognition` implementation is not inherently device-only. Some browsers may process recognition through a vendor service. A strict no-external-processing promise requires verified offline recognition support or disabling voice recognition where that guarantee cannot be made.
- Browser speech synthesis may use installed local voices, but the privacy guarantee should be validated for supported platforms before labeling it device-only.
- The existing pool directory already filters the active annual schema's amenity strings. Voice amenity aliases must normalize to that same string-based foundation so typed, filtered, and spoken results cannot drift.
- Existing search currently displays broad meet and practice links rather than resolving relative dates and selected favorites. The intent scope below describes target behavior, not a claim that every intent is already implemented.

## Shared Answer Semantics

### Published Status

For questions using `open`, `closed`, or `available`, the assistant answers from the published seasonal schedule and any published schedule override in the active data. It should say `scheduled to be open` or `scheduled public swim` rather than suggesting live confirmation.

`Open` should mean the pool has a public-use activity during the requested interval. A slot marked `Closed to Public`, `CNSL Practice Only`, `Swim Meet`, or another restricted/event use does not satisfy a request for a pool that the user can swim in.

### Dates And Times

- Use Eastern Time for pool and CNSL schedule interpretation.
- Support `now`, `today`, `tonight`, `tomorrow`, `this weekend`, weekdays, and a spoken calendar date in the first implementation.
- For `the next two hours`, require continuous public availability from the current time through the end of the requested duration; mention a pool that closes before then only as an excluded near match on screen.
- When the season is not active or data has no matching period, explicitly say that no published schedule is available for that date.

### Favorite Resolution

Apply these rules whenever a question contains `my`, `mine`, or `favorite`:

| Wording | Resolution rule | Missing-setting reply |
| --- | --- | --- |
| `my team`, `my practice`, `my meet`, `favorite team` | Use `favoriteTeamId` to identify the saved team. | `You do not have a favorite team selected yet. Choose one in Settings or ask about a team by name.` |
| `my pool`, `favorite pool` | Use `favoritePoolName` to identify the saved pool. | `You do not have a favorite pool selected yet. Choose one in Settings or ask about a pool by name.` |
| `near me` | Ask for one-time location permission for this answer; it is separate from favorites. | If permission is denied, offer a named or favorite-pool question instead. |

The assistant must not silently make a pool or team a favorite because it was named in a voice question.

### Proximity

For `near me` questions, use browser geolocation and stored pool coordinates only after the user invokes that intent. The default nearby result should present up to three qualifying pools ordered by approximate distance in miles. Coordinates should stay in memory for the current page session and should not be persisted or included in analytics.

## Question Scope

### MVP Intents

These question families have clear user value and can be answered from active-season data plus device capabilities.

| Intent | Sample utterances | Required context | Answer content |
| --- | --- | --- | --- |
| Pool public availability | `Which pools are open now?` `What pools are open for the next two hours?` `Is my pool open tonight?` | Published schedules; favorite pool only when requested. | Pool names, usable public-swim interval, relevant special schedule note, and published-schedule qualification. |
| Nearby public availability | `What pools near me are open for the next two hours?` `Find an open pool nearby.` | One-time location permission, coordinates, schedules. | Up to three closest qualifying pools with distance and closing time. |
| Pool amenities | `Which pools have water slides?` `What pool has a beach entry?` `Does my pool have a pool lift?` | Amenity string normalization; favorite pool when requested. | Matching pool names or yes/no for a named pool, with amenity label as published. |
| Pool location | `Where is Kendall Ridge pool?` `How far is my pool?` | Location fields; permission only for distance. | Address, optional approximate distance, and a visible maps action. |
| Team practice | `When is my team's swim practice today?` `Where do the Marlins practice tonight?` | Favorite team or named team, detailed practice records, date parsing. | Session time, group when present, and practice location; state when no published session matches. |
| Team meet | `When is my team's meet this weekend?` `Who do the Barracudas swim next?` | Favorite team or named team and meet schedule. | Date, matchup or meet name, location, and whether the team is home or visiting when known. |
| Upcoming meets | `Are there any meets this weekend?` `Where is the next meet?` | Meet schedule and date parsing. | Matching meets ordered by date with location. |

### Next Intents

These are sensible after the core resolver and accessibility behavior are reliable.

| Intent | Example | Why it follows the MVP |
| --- | --- | --- |
| Combined amenity and availability filters | `Find a nearby pool with a slide that is open this afternoon.` | Requires composition of location, amenity, and interval filtering with good no-result explanations. |
| Pool schedule detail | `What time does my pool open tomorrow?` `When is lap swim at Hopewell?` | Requires consistent treatment of activity types, not only public availability. |
| Team contact or staff lookup | `Who is the coach for my team?` | Data exists for many teams, but reading personal contact details aloud needs a privacy and presentation decision. |
| Short follow-up context | `What about tomorrow?` after asking about a pool. | Requires a local conversation state model and a visible way to clear it. |

### Out Of Scope Initially

| Request type | Example | Reason |
| --- | --- | --- |
| Live operational claims | `Is the pool crowded?` `Did thunder close the pool?` | The seasonal data is not a live facility status feed. |
| Open-ended recommendations | `Where should we spend the afternoon?` | Requires subjective ranking beyond published facts. |
| Registration, policy, or document Q&A | `Can my child join the team?` | Needs a separate curated knowledge scope and citation behavior. |
| Free-form AI conversation | `Plan our summer swim schedule.` | Conflicts with the deterministic, no-external-AI boundary. |

## Vocabulary And Intent Notes

The deterministic parser should map common spoken variants to canonical data concepts:

| User wording | Canonical concept |
| --- | --- |
| `water slide`, `waterslide`, `slides` | `slide` |
| `zero entry`, `beach access`, `beach entry` | `beach entry` |
| `accessible`, `lift`, `ADA` | Ask whether the user means `pool lift` or `ADA compliant` when ambiguous. |
| `baby pool`, `kiddie pool` | `wading` or `shallow`; show which published amenity matched. |
| `practice`, `training` | team practice |
| `meet`, `swim meet`, `competition` | meet schedule |

For ambiguous questions, ask one focused clarification on screen and by speech only when speech replies are enabled. Example: `Do you mean pools with a pool lift or pools listed as ADA compliant?`

## Accessibility And Output Modes

### Recommended Default

Every answer should be printed to the screen in a semantic, screen-reader-friendly response region. TTS should be an optional output preference, not a replacement for visible text. This supports Deaf and hard-of-hearing users, users in noisy environments, speech-recognition correction, links and maps, and anyone who wants to re-read schedule details.

### Interaction Modes

| Mode | Input | Output | Default behavior |
| --- | --- | --- | --- |
| Text only | Keyboard or touch typing | Visible answer announced through the existing live region. | Always available and the initial default. |
| Voice input with visible reply | Press-to-talk plus editable transcript | Visible answer and live-region announcement. | Recommended first voice release. |
| Voice input with spoken and visible reply | Press-to-talk plus editable transcript | Concise TTS summary plus full visible answer. | Opt-in after TTS is enabled in Settings. |
| Spoken replay | Any completed answer | User presses a `Read answer aloud` control. | Available whenever TTS is supported, even if automatic TTS is off. |

### Accessibility Requirements

- Preserve a typed query path even when microphone access is available.
- Show the recognized transcript before or with the result and let the user edit and resubmit it.
- Give the microphone button an accessible label and expose `Listening`, `Processing`, `Speaking`, permission-denied, and unsupported states as text/status announcements.
- Provide immediate `Stop listening` and `Stop speaking` controls while those states are active.
- Never auto-start the microphone on page load and never listen continuously in the background.
- Keep detailed results visible even when a shorter spoken response is used.
- Do not rely on icons, color, or spoken output alone to communicate open/closed status or errors.
- If speech recognition is unavailable or does not meet the device-only requirement, hide or disable voice input with a clear visible explanation while typed questions continue to work.

### Spoken Response Style

Spoken answers should be brief and action-oriented, while visible results may list all matches and links.

| Question | Example spoken response | Additional visible detail |
| --- | --- | --- |
| `What pools near me are open for the next two hours?` | `Three nearby pools are scheduled for public swim for the next two hours. The closest is Kendall Ridge, about 1.2 miles away.` | Ranked matches, times, schedule notes, distance, links. |
| `When is my team's practice today?` | `Your team, the Long Reach Marlins, practices today at 6 PM at Locust Park.` | All matching groups/sessions and official source link when supplied. |
| `Which pools have a beach entry?` | `I found two pools listed with beach entry: Hopewell and Running Brook.` | All matched pools and amenity labels. |

## Privacy And Device-Only Boundary

- Query interpretation and answer construction must be local deterministic JavaScript operating on active-season site data.
- Favorite pool and team settings remain in browser storage and are read only when needed for an answer.
- Location is requested only after a proximity question and is not stored after the page session.
- No transcript, microphone audio, location, favorite, or query history should be uploaded by this feature.
- Do not advertise speech recognition as device-only until the chosen implementation is demonstrated to process audio locally on every supported browser/platform combination. If browser guarantees differ, make the privacy limitation visible before permission is requested or offer typed input only.

## MVP Acceptance Scenarios

| Given | When | Expected answer behavior |
| --- | --- | --- |
| A favorite team is stored and it has a practice today | The user asks `When is my practice today?` | Resolve the saved team and show/speak today's published session and location. |
| No favorite team is stored | The user asks `When is my team's next meet?` | Prompt the user to choose a favorite in Settings or name a team; do not guess. |
| Location permission is granted and multiple pools qualify | The user asks for pools nearby that are open for the next two hours | List up to three nearest pools that have continuous public-use schedule coverage for the interval. |
| Location permission is denied | The user asks `What pools near me are open?` | Explain location is needed for nearby sorting and still offer a non-location open-pools result. |
| A pool is scheduled for team practice only | The user asks which pools are open for public swimming | Do not include that pool as publicly open; visible output can explain the restricted slot. |
| The user's wording maps to `beach entry` | The user asks for a zero-entry pool | Return pools bearing the published matching amenity label. |
| Automatic TTS is off | Any question is answered | Always render and announce the visible answer; do not speak it automatically. |
| Speech cannot meet the device-only requirement | The user views the assistant | Keep typed question handling available and do not offer unsupported private voice recognition. |

## Suggested Delivery Order

1. Build a deterministic intent/result layer for typed questions, including favorites, dates, amenity string matching, and public-use availability semantics.
2. Add screen-first answer presentation with concise plain-text summaries suitable for either live-region announcements or later TTS.
3. Add one-time geolocation handling for `near me`, including denied-permission fallback and non-persistence tests.
4. Restore press-to-talk only after selecting and validating an acceptable device-only recognition approach for supported environments.
5. Add opt-in TTS and replay/stop controls after accessibility testing with visible results retained.

## Decisions To Confirm Before Implementation

- Is strict offline/device-only speech recognition a launch requirement, even if that limits the supported browsers or requires an additional local recognition library/model?
- Should TTS default to off, with `Read answer aloud` available immediately, or should a dedicated voice mode auto-speak replies after opt-in?
- Does `open` mean public recreational swimming only, or should the assistant expose other available activities such as lap swim separately when asked?
- For `near me`, is a default of the closest three matching pools appropriate, and should the distance radius be configurable?
- Should follow-up questions retain temporary context in a later release, or should each initial release query be complete on its own?
