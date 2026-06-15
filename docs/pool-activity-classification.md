# Pool Activity Access Classification

This document is the canonical decision record for classifying pool schedule activities. Use it when transcribing annual pool schedules, reviewing source corrections, and extending the pool schema. The annual schema enforces the listed single-activity and combined-activity mappings so a new label or combination requires an explicit review.

## Governing Rules

`accessStatus` describes whether the represented pool time is available for general public use. It is semantic data and must come from published access conditions, not from the activity's wording, color, or presentation.

- Set `accessStatus` to `public` when the scheduled use is available without enrollment in a particular program. Age, facility-admission, and ordinary safety qualifications do not make access restricted. Adult Laps, Adult Swim, and Senior Swim therefore use `"accessStatus": "public"`.
- Set `accessStatus` to `restricted` for a class or recurring program whose participants use the pool for that activity rather than general swimming. Registration is sufficient but not required; drop-in Aqua Fitness uses `"accessStatus": "restricted"` because the pool time is for program participation.
- Set `accessStatus` to `practice-only` when the represented pool time is reserved for a swim-team practice.
- Set `accessStatus` to `special-event` when a one-time event replaces ordinary public swimming, whether attendance is open, invited, or registration-based.
- Set `accessStatus` to `swim-meet` for a swim meet that replaces ordinary public swimming.
- Set `accessStatus` to `closed-to-public` when the source explicitly closes the pool to public use.
- Assign `accessStatus` to the whole slot according to the access that remains available. A restricted program may share a slot with `"accessStatus": "public"` when another named activity provides genuine general use. Record each simultaneous use as a separate slot when their access conditions or time boundaries differ.
- Do not combine public labels with an exclusive activity merely to imply availability. The source must explicitly establish public lane, pool, or facility use, and `notes` should preserve useful lane-allocation context.

## Access Status Values

| `accessStatus` value | Meaning for the complete schedule slot |
| --- | --- |
| `public` | General public use is available, including use subject only to age, admission, or ordinary safety qualifications. |
| `restricted` | The pool time is available for participation in a recurring class or program, not for general swimming. |
| `practice-only` | The represented time is reserved for swim-team practice and has no concurrent general-use activity. |
| `special-event` | A one-time event replaces ordinary public swimming. |
| `swim-meet` | A swim meet replaces ordinary public swimming. |
| `closed-to-public` | The pool is explicitly closed to public use. |

## Hours Record Contract

Every object in a schedule or schedule-override `hours` array follows one field-level contract:

- `types` is a nonempty array. Its exact value must appear in the activity matrix or approved combined-activities table.
- `accessStatus` is the sole semantic owner of public availability. Do not add a separate event or restriction flag that duplicates it.
- `weekDays` contains one or more unique weekday values.
- Every status except `closed-to-public` requires both `startTime` and `endTime`.
- A `closed-to-public` record may omit both times to represent an all-day closure, or supply both for a timed closure. It may not supply only one.
- Times use a 12-hour clock with `am` or `pm`, and `endTime` must be later than `startTime` on the same day.
- Use an approved combined `types` array when the source publishes simultaneous uses as one shared slot with one whole-slot `accessStatus`. Use separate overlapping records when simultaneous activities have different boundaries or access conditions.

## Activity Matrix

| Activity in `types` | Required `accessStatus` when alone | Rule type | Rationale and annual-review guidance |
| --- | --- | --- | --- |
| Adult Laps Only | `public` | Fixed | Set `accessStatus` to `public`; age qualification is a facility-use rule and no program enrollment is required. |
| Adult Swim | `public` | Fixed | Set `accessStatus` to `public`; age qualification does not restrict admission to a particular program. |
| Aqua Fitness | `restricted` | Fixed alone | Set `accessStatus` to `restricted`; this is program use rather than general swimming, including published drop-in classes without advance registration. |
| Clippers Practice Only | `practice-only` | Fixed | Set `accessStatus` to `practice-only`; the time is reserved for the Clippers program. |
| Closed | `closed-to-public` | Fixed | Set `accessStatus` to `closed-to-public`; the pool is closed rather than available for public use. |
| Closed to Public | `closed-to-public` | Fixed | Set `accessStatus` to `closed-to-public`; the source explicitly excludes public use. |
| Combo Fitness | `restricted` | Fixed alone | Set `accessStatus` to `restricted`; the scheduled time is for participation in a recurring fitness program. |
| CNSL Practice Only | `practice-only` | Fixed alone | Set `accessStatus` to `practice-only` unless an approved combined `types` array identifies concurrent public use. |
| Laps | `public` | Fixed alone | Set `accessStatus` to `public`; ordinary lap swimming is general use subject to normal admission and safety rules. |
| Lessons | `restricted` | Context-dependent | Set `accessStatus` to `restricted` when alone. An approved combined slot uses `public` only when a separately named general-use activity remains available. |
| Masters Swim | `restricted` | Context-dependent | Set `accessStatus` to `restricted` when alone. An approved Masters and Adult Laps slot uses `public` because general adult lap access remains available. |
| Pool Party | `special-event` | Fixed | Set `accessStatus` to `special-event`; a scheduled party replaces ordinary public swimming. Registration or invitation details belong in the event reason or official source. |
| Rec Swim | `public` | Fixed alone | Set `accessStatus` to `public`; recreational swimming is general public use. |
| Senior Swim | `public` | Fixed | Set `accessStatus` to `public`; age qualification is a facility-use rule rather than program enrollment. |
| Special Event | `special-event` | Fixed | Set `accessStatus` to `special-event`; the event replaces ordinary public swimming and has event-specific participation conditions. |
| Swim Meet | `swim-meet` | Fixed | Set `accessStatus` to `swim-meet`; a meet is a distinct exclusive pool use, not general swimming. |
| Ultimate Rec Swim | `public` | Fixed | Set `accessStatus` to `public`; this is a published recreational-swim format available as general use. |
| Wading Pool | `public` | Fixed alone | Set `accessStatus` to `public`; the wading area is general use subject to normal eligibility and supervision rules. |
| Wibit | `public` | Fixed | Set `accessStatus` to `public`; the published Wibit period is a general-use recreational activity. |
| Yoga | `restricted` | Fixed alone | Set `accessStatus` to `restricted`; the scheduled time is for participation in a recurring fitness program. |

## Approved Combined Activities

Combined activity arrays are explicit contracts. Preserve the published order and do not create a new combination without updating this document and the annual schema.

| Exact `types` array | Required `accessStatus` | Rationale |
| --- | --- | --- |
| `["Laps", "Rec Swim"]` | `public` | Set `accessStatus` to `public`; both activities are general use. |
| `["Lessons", "Rec Swim"]` | `public` | Set `accessStatus` to `public`; Rec Swim remains available while registered lessons use assigned lanes. |
| `["Lessons", "Wading Pool"]` | `public` | Set `accessStatus` to `public`; the wading pool remains available while registered lessons use the main pool. |
| `["Masters Swim", "Adult Laps Only"]` | `public` | Set `accessStatus` to `public`; adult lap lanes remain available while Masters uses other lanes. |
| `["Laps", "Rec Swim", "CNSL Practice Only"]` | `public` | Set `accessStatus` to `public`; public swimming remains available in shared lanes while CNSL practice uses assigned lanes. |

## Maintenance Contract

For every annual transcription or source correction:

1. Match each published activity and exact combined array to this matrix.
2. Verify access conditions from the official source, including whether the activity requires program participation and whether general-use water remains available concurrently.
3. Add a new matrix row or combined-activity row before adding an unrecognized schedule value.
4. Update the annual pool schema in the same change, advance its version when the validation contract changes, and validate the annual JSON.
5. Confirm every hours record follows the field and time rules above, including same-day chronological order.
6. Record ambiguous source wording in the annual README and leave the activity unpublished until its access conditions can be classified confidently.
