const DEFAULT_STAFF_GUIDE_DOCUMENT_URL =
    'https://docs.google.com/document/d/1-HhMjftqUdLhgdmoLhNSrNcpvkcwlo_p2JZ_4ri1C3o/edit?tab=t.3qivgdyxzvm9';

const STAFF_GUIDE_DOCUMENT_URL =
    process.env.STAFF_GUIDE_DOCUMENT_URL ||
    DEFAULT_STAFF_GUIDE_DOCUMENT_URL;

const CHAIN_OF_COMMAND = [
    'Founder',
    'Assistant Founder',
    'Director',
    'Assistant Director',
    'Head of Staff',
    'Head Staff Supervisor',
    'Staff Supervisor',
    'Trial Staff Supervisor',
    'Senior Management',
    'Management',
    'Trial Management',
    'Internal Affairs Director',
    'Internal Affairs',
    'Trial Internal Affairs',
    'Head Administrator',
    'Senior Administrator',
    'Administrator',
    'Head Moderator',
    'Senior Moderator',
    'Moderator',
    'Trial Moderator',
];

function lines(...values) {
    return values.flat().join('\n');
}

const GUIDE_SECTIONS = [
    {
        id: 'introduction',
        label: 'Introduction & Mission',
        description: 'Mission, values, readiness, and chain of command.',
        emoji: '⭐',
        tabId: 't.3qivgdyxzvm9',
        color: 0x3498db,
        intro:
            'The handbook is the official operational guide for every Illinois State Roleplay staff member. Staff permissions are a responsibility and every action should strengthen fairness, safety, and community confidence.',
        fields: [
            {
                name: 'Mission',
                value:
                    'Provide a professional, fair, and enjoyable roleplay environment through consistent moderation, teamwork, integrity, and respect.',
            },
            {
                name: 'Core Values',
                value: lines(
                    '• **Professionalism** — remain respectful in every situation.',
                    '• **Integrity** — stay honest, unbiased, and accountable.',
                    '• **Consistency** — apply rules equally.',
                    '• **Teamwork** — support an organized, welcoming community.',
                    '• **Leadership** — lead by example at every rank.'
                ),
            },
            {
                name: 'Staff Readiness',
                value: lines(
                    '1. Read every section carefully.',
                    '2. Understand policy before taking action.',
                    '3. Apply procedures fairly and consistently.',
                    '4. Ask Management or Internal Affairs when uncertain.',
                    '5. Remember that your conduct represents the staff team.'
                ),
            },
            {
                name: 'Staff Motto',
                value:
                    '*“Professionalism isn’t defined by rank—it’s demonstrated through every action you take.”*',
            },
        ],
    },
    {
        id: 'rules',
        label: 'Rules & Guidelines',
        description: 'Professional conduct and operational standards.',
        emoji: '📜',
        tabId: 't.0',
        color: 0x3498db,
        intro:
            'These rules establish the consistency, professionalism, fairness, and accountability expected throughout all staff activity.',
        fields: [
            {
                name: 'Every Staff Member Must',
                value: lines(
                    '• Remain professional at all times.',
                    '• Treat every player fairly and respectfully.',
                    '• Follow server policies and procedures.',
                    '• Represent ISRP positively.',
                    '• Ask for assistance whenever uncertain.'
                ),
            },
            {
                name: 'Broadcast Announcements',
                value:
                    'Staff below Supervisory must receive approval from the Staff Supervisor Board or higher before using public `:M` or `:H` announcements.',
            },
            {
                name: 'Confidentiality',
                value:
                    'Internal materials, discussions, punishment logs, and confidential information must remain inside authorized staff channels. Unauthorized disclosure may result in immediate discipline.',
            },
            {
                name: 'Professionalism & Fairness',
                value:
                    'Remain respectful on duty, off duty, in-game, and across official platforms. Bias, favoritism, retaliation, command abuse, and intentional policy violations are prohibited.',
            },
            {
                name: 'In-Game Conduct',
                value:
                    'Staff should follow applicable traffic laws while staffing unless an active moderation responsibility reasonably requires otherwise.',
            },
        ],
    },
    {
        id: 'punishments',
        label: 'In-Game Punishments',
        description: 'Progressive discipline and punishment matrix.',
        emoji: '⚖️',
        tabId: 't.lc8fgy4qexxa',
        color: 0xe67e22,
        intro:
            'Find the verified incident, confirm the player’s current offense count, and read across the matching matrix row. Escalate only as listed unless authorized leadership directs otherwise.',
        fields: [
            {
                name: 'Critical Controls',
                value: lines(
                    '• A kicked player must wait **60 minutes** before rejoining; returning early results in a ban.',
                    '• Use `x2` to mark a second offense.',
                    '• Verify the exact Roblox username and offense history before escalating.',
                    '• Document every formal action accurately.'
                ),
            },
            {
                name: 'Scene Resets & Lower-Level Conduct',
                value: lines(
                    '• Disrupting roleplay/mod scenes: `:load` → Warning → Kick.',
                    '• Unauthorized RP, liveries, jurisdiction, traffic, and PA abuse generally begin with verbal correction, then Warning, then Kick.',
                    '• Whitelisted cars/liveries without access may include `:load` and a direction to change.'
                ),
            },
            {
                name: 'Warning → Kick → Ban',
                value: lines(
                    'RDM, FRP, VDM, GTA driving, NLR, cuff rushing, crash-roleplay failure, denying detainment, fear-RP failure, priority-timer violations, command abuse, disrespect, tow rushing, banned roleplays, cop-baiting plates, and most tool abuse follow this progression.',
                    'LTAA progresses **Warning → Ban**.'
                ),
            },
            {
                name: 'Kick → Ban',
                value:
                    'Staff RDM, trolling/NITRP, disobeying staff, towing staff cars, staff evasion, self-advertising, shooting/VDM against staff vehicles, RDM in a moderation scene, and lying to staff.',
            },
            {
                name: 'Immediate Ban Categories',
                value:
                    'Early kick rejoin, staff impersonation, platform Terms-of-Use violations, LTAP, mass RDM, troll usernames, vehicle glitching, and mini-modding.',
            },
        ],
    },
    {
        id: 'melonly',
        label: 'Melonly Logging',
        description: 'Accurate punishment logging workflow.',
        emoji: '📝',
        tabId: 't.xwtf3rlhdwmy',
        color: 0x5865f2,
        intro:
            'Use this checklist whenever creating a punishment log in Melonly.',
        fields: [
            {
                name: 'Before Logging',
                value: lines(
                    '1. Open the Melonly moderation group using the access details in Staff Information.',
                    '2. Start your moderation shift.',
                    '3. Confirm the website panel shows you as **on shift** before continuing.'
                ),
            },
            {
                name: 'Create the Log',
                value: lines(
                    '1. Open **Create New Log**.',
                    '2. Enter the player’s **exact Roblox username**.',
                    '3. Select the punishment type actually issued.',
                    '4. State the violated rule and relevant offense count clearly.',
                    '5. Verify the username, punishment, reason, and count before submitting.'
                ),
            },
        ],
    },
    {
        id: 'commands',
        label: 'Commands & Prefixes',
        description: 'Approved command families and safety checks.',
        emoji: '⌨️',
        tabId: 't.v3gvmqscg4eg',
        color: 0x3498db,
        intro:
            'Use the right tool, for the right reason, at the right time. Never guess syntax or permissions.',
        fields: [
            {
                name: 'Command Families',
                value: lines(
                    '`:` — in-game moderation and server actions.',
                    '`!` — member assistance and report requests.',
                    '`?` — approved Illinois State Utilities tools; verify exact syntax using `?help`.',
                    'Other prefixes are platform-specific and must not be assumed.'
                ),
            },
            {
                name: 'Verified Commands',
                value: lines(
                    '` :M / :H ` — approved server-wide announcements.',
                    '` :load ` — matrix-authorized scene reset.',
                    '` :wanted ` — matrix-authorized corrective action.',
                    '` :refresh ` — matrix-authorized tool-abuse reset.',
                    '` !mod / !help ` — member assistance requests.'
                ),
            },
            {
                name: 'Five-Step Command Check',
                value: lines(
                    '1. Verify command syntax and rank permission.',
                    '2. Confirm the correct player and offense count.',
                    '3. Check evidence and approval requirements.',
                    '4. Execute once and observe the result.',
                    '5. Log the command, reason, evidence, and outcome.'
                ),
            },
            {
                name: 'Prohibited Use',
                value:
                    'Never use commands for entertainment, retaliation, shortcuts, personal advantage, or an action unsupported by current policy.',
            },
        ],
    },
    {
        id: 'moderation',
        label: 'Moderation Operations',
        description: 'Reports, scenes, evidence, and decisions.',
        emoji: '🛡️',
        tabId: 't.iuh1vu18x4ru',
        color: 0x3498db,
        intro:
            'Pause, verify, resolve, and document. Respond by priority while keeping active scenes safe and organized.',
        fields: [
            {
                name: 'Priority Order',
                value: lines(
                    '🔴 **Critical** — mass disruption, platform-safety concerns, widespread harm.',
                    '🟠 **High** — active RDM/VDM, major trolling, evasion, punishment avoidance.',
                    '🔵 **Standard** — routine violations, RP disputes, jurisdiction, liveries.',
                    '⚪ **Assistance** — questions and non-urgent support.'
                ),
            },
            {
                name: 'Six-Step Scene Workflow',
                value: lines(
                    '1. Take ownership and identify all involved players.',
                    '2. Stabilize the scene.',
                    '3. Collect statements and evidence.',
                    '4. Match verified conduct and count to the matrix.',
                    '5. Explain and issue the authorized action.',
                    '6. Complete the log and release the scene.'
                ),
            },
            {
                name: 'One Scene, One Owner',
                value:
                    'Do not compete for control or issue overlapping punishments. Assist when asked, when ownership transfers, or when urgent authorized safety action is required.',
            },
            {
                name: 'Evidence & Conflicts',
                value:
                    'Use verified observation, recordings, screenshots, logs, and consistent witness accounts. Transfer cases involving yourself, close friends, or a reasonable impartiality concern.',
            },
            {
                name: 'Closure Standard',
                value:
                    'Record the correct username, offense count, reason, evidence, command, approval, outcome, and any assigned follow-up.',
            },
        ],
    },
    {
        id: 'internal_affairs',
        label: 'Internal Affairs',
        description: 'Complaints, investigations, discipline, and appeals.',
        emoji: '🔍',
        tabId: 't.ur2q62xsgxgl',
        color: 0x2b2d31,
        intro:
            'Investigate facts, protect fairness, maintain confidentiality, and document every decision.',
        fields: [
            {
                name: 'Complaint Intake',
                value: lines(
                    '• Record the reporter, accused staff member, date, location, and allegation.',
                    '• Preserve links, recordings, screenshots, logs, and messages.',
                    '• Identify urgent access or safety risks.',
                    '• Assign an impartial investigator with proper authority.'
                ),
            },
            {
                name: 'Investigation Sequence',
                value:
                    'Define the possible policy issue, review original evidence, interview parties separately, consider authorized history, write a factual finding, and route the recommendation to the authorized decision-maker.',
            },
            {
                name: 'Corrective Levels',
                value:
                    'Coaching → verbal warning → written warning/performance plan → suspension/demotion/restriction → removal. Serious severity, intent, retaliation, dishonesty, risk, or history may justify starting higher.',
            },
            {
                name: 'Appeals & Confidentiality',
                value:
                    'Appeals should identify a challenged finding, new evidence, or procedural error. Use an independent reviewer when available. Limit case information to those who investigate, decide, implement, or review it; retaliation is prohibited.',
            },
        ],
    },
    {
        id: 'training',
        label: 'Training & Promotions',
        description: 'Onboarding, certification, and advancement.',
        emoji: '🎓',
        tabId: 't.b28b07op7o1y',
        color: 0x2ecc71,
        intro:
            'Train for consistency and promote for demonstrated readiness—not popularity, friendship, or staffing convenience.',
        fields: [
            {
                name: 'Development Phases',
                value: lines(
                    '**Orientation** — handbook, chain, confidentiality, culture.',
                    '**Observation** — reports, scenes, matrix, and logging.',
                    '**Guided Practice** — supervised scenario handling.',
                    '**Certification** — independent readiness review.'
                ),
            },
            {
                name: 'Certification Evidence',
                value:
                    'Policy knowledge, verified command syntax, correct matrix use, complete Melonly logs, conflict recognition, proper escalation, and calm communication.',
            },
            {
                name: 'Promotion Readiness',
                value:
                    'Review policy knowledge, judgment, consistency, documentation, communication, leadership, reliability, current requirements, unresolved discipline, logs, training notes, and next-rank duties.',
            },
            {
                name: 'Not Yet Is Not Never',
                value:
                    'When advancement is deferred, provide specific development goals and a fair opportunity to improve. Never promise a promotion date.',
            },
        ],
    },
    {
        id: 'on_shift',
        label: 'On-Shift Quick Guide',
        description: 'Start, run, transfer, and close a shift safely.',
        emoji: '🟢',
        tabId: 't.cmfuelu8mf1p',
        color: 0x2ecc71,
        intro:
            'Confirm your tools and priorities before accepting the first report, then finish or clearly transfer every open matter.',
        fields: [
            {
                name: 'Before Going Active',
                value:
                    'Review announcements and temporary directives, confirm Melonly shows you on shift, verify approved tools, know the available chain of command, and do not accept a scene you cannot complete or transfer.',
            },
            {
                name: 'Live Scene Snapshot',
                value:
                    'Identify everyone involved → stop disruption → collect evidence and statements → confirm rule and offense count → issue the authorized action → log the outcome.',
            },
            {
                name: 'Decision Ladder',
                value:
                    'Check whether harm is continuing, identity/evidence are verified, offense count is confirmed, action is within your authority, and the final action is fully logged.',
            },
            {
                name: 'Before Ending Shift',
                value:
                    'Finish or transfer scenes, complete logs, route unresolved safety/staff/appeal matters, end the Melonly shift, and keep evidence only in authorized locations.',
            },
        ],
    },
    {
        id: 'scenarios',
        label: 'Scenario Playbook',
        description: 'Consistent responses to difficult situations.',
        emoji: '🚨',
        tabId: 't.xqfgmsbfsx9a',
        color: 0xe67e22,
        intro:
            'Stabilize first, verify second, and act with purpose. One staff member should own each scene.',
        fields: [
            {
                name: 'First Moves',
                value: lines(
                    '**RDM/VDM:** stabilize, identify players, preserve direct evidence.',
                    '**Disrupted mod scene:** establish one owner and separate interruptions.',
                    '**Conflicting stories:** collect accounts separately and compare evidence.',
                    '**Evasion:** verify identity/history and notify leadership.',
                    '**Mass disruption:** protect the server and request coordinated support.'
                ),
            },
            {
                name: 'Universal Sequence',
                value:
                    'Claim → stabilize → verify → match policy/count → communicate and act once → document evidence, commands, approval, outcome, and follow-up.',
            },
            {
                name: 'Uncertain Evidence',
                value:
                    'Separate facts from assumptions. If evidence cannot support a finding, document the uncertainty and do not invent certainty.',
            },
            {
                name: 'When Staff Are Involved',
                value:
                    'Preserve evidence, transfer the case to an impartial supervisor or Internal Affairs, maintain confidentiality, and prevent retaliation or public argument.',
            },
        ],
    },
    {
        id: 'evidence',
        label: 'Evidence & Reports',
        description: 'Reliable proof and professional case writing.',
        emoji: '📹',
        tabId: 't.xk7vcc1r0kd',
        color: 0x5865f2,
        intro:
            'Write what happened, show how you know, and record what followed. Describe observable conduct without unsupported intent or exaggeration.',
        fields: [
            {
                name: 'Evidence Sources',
                value:
                    'Direct observation, complete recordings, contextual screenshots, system/moderation logs, and specific first-hand witness statements. Reputation or hearsay is only a lead—not proof.',
            },
            {
                name: 'Five-Part Report',
                value: lines(
                    '**Identity** — exact username and relevant ID.',
                    '**Event** — what, where, and when.',
                    '**Evidence** — support for each material fact.',
                    '**Decision** — rule, count, approval, and action.',
                    '**Outcome** — result, response, and follow-up owner.'
                ),
            },
            {
                name: 'Strong Writing',
                value:
                    'Replace vague labels such as “trolling” or “handled” with specific observable conduct, reliable evidence, the exact offense, action, and final outcome.',
            },
            {
                name: 'Preservation',
                value:
                    'Keep original context when practical, store evidence only in authorized locations, limit access, preserve appeal/IA material, and follow current retention rules.',
            },
        ],
    },
    {
        id: 'emergencies',
        label: 'Emergencies & Major Incidents',
        description: 'Containment, escalation, and coordinated recovery.',
        emoji: '🆘',
        tabId: 't.bhwu6rz25g9',
        color: 0xe74c3c,
        intro:
            'Protect the community, preserve the facts, and coordinate the response. Urgency never expands a staff member’s rank authority.',
        fields: [
            {
                name: 'Incident Levels',
                value: lines(
                    '🔴 **Critical** — widespread harm, compromised access, platform safety.',
                    '🟠 **High** — coordinated trolling, repeated evasion, major staff conflict.',
                    '🟡 **Elevated** — suspicious patterns, command failures, rising reports.',
                    '🔵 **Routine** — standard reports and assistance.'
                ),
            },
            {
                name: 'Major Incident Sequence',
                value:
                    'Assign an incident owner → notify leadership → contain authorized harm → preserve a timestamped record → split tasks when possible → provide factual updates → record recovery and follow-up.',
            },
            {
                name: 'Special Playbooks',
                value:
                    'Mass disruption, compromised staff access, platform-safety/exploit concerns, and suspected staff abuse each require private escalation, preserved evidence, minimal disclosure, and a documented owner.',
            },
            {
                name: 'Handoff & Review',
                value:
                    'Transfer verified facts, timeline, actions, commands, evidence locations, remaining risk, and follow-up ownership. Complete an after-action review focused on learning and accountability.',
            },
        ],
    },
    {
        id: 'leadership',
        label: 'Leadership & Supervision',
        description: 'Coaching, approvals, oversight, and conflict resolution.',
        emoji: '🏛️',
        tabId: 't.x01kjx33zvw3',
        color: 0xf1c40f,
        intro:
            'Set the standard, support the team, and document the decision. An approval is a judgment—not a shortcut around evidence or policy.',
        fields: [
            {
                name: 'Leadership Cycle',
                value:
                    'Before activity: review directives, staffing, risks, and escalation coverage. During activity: guide difficult scenes and prevent duplicate moderation. After activity: review logs, assign follow-up, coach gaps, and recognize reliable performance.',
            },
            {
                name: 'Five-Step Coaching Model',
                value:
                    'Describe the behavior → explain policy/impact → hear relevant context → set a measurable correction → document material or recurring concerns.',
            },
            {
                name: 'Approval Check',
                value:
                    'Verify identity, facts, evidence, policy, authority, proportionality, history, required controls, and whether the record will remain understandable during review.',
            },
            {
                name: 'Conflict Resolution',
                value:
                    'Move disagreements out of public scenes, establish one scene owner, pause overlapping actions, compare evidence and authority, transfer conflicts when necessary, and document final direction.',
            },
            {
                name: 'Leadership Trust',
                value:
                    'Never use rank to protect friends, punish criticism, suppress good-faith reports, bypass review, or excuse retaliation and dishonesty.',
            },
        ],
    },
    {
        id: 'faq',
        label: 'Staff FAQ',
        description: 'Quick answers and preventable mistakes.',
        emoji: '❓',
        tabId: 't.562s8tdqg0z8',
        color: 0x3498db,
        intro:
            'Ask early, verify carefully, and correct mistakes honestly. The newest authorized handbook, matrix, Staff Information, bot help, and leadership direction take priority.',
        fields: [
            {
                name: 'Common Questions',
                value: lines(
                    '**Unsure which rule applies?** Pause, preserve, check, and ask upward.',
                    '**Incomplete evidence?** Continue checking or close without a finding.',
                    '**Another staff member owns it?** Assist only when asked, transferred, or urgently required.',
                    '**A friend is involved?** Disclose and transfer the conflict.',
                    '**A member disagrees?** Explain the rule and appeal route once.'
                ),
            },
            {
                name: 'Command or Target Mistake',
                value:
                    'Stop, correct continuing harm, notify appropriate leadership, preserve the record, and document the mistake honestly. Concealment usually creates a larger concern.',
            },
            {
                name: 'Common Preventable Errors',
                value:
                    'Guessing syntax, duplicate moderation, incomplete logs, arguing publicly, acting beyond authority, favoritism, and retaliation.',
            },
            {
                name: 'Before Pressing Enter',
                value:
                    'Right command. Right Roblox account. Right rule and offense count. Right evidence. Right permission and approval. Right log and follow-up.',
            },
        ],
    },
    {
        id: 'activity_leave',
        label: 'Activity, Leave & Resignation',
        description: 'Availability, handoffs, return, and departure.',
        emoji: '📅',
        tabId: 't.qdq07jbcx72k',
        color: 0x5865f2,
        intro:
            'Communicate early, transfer responsibly, and leave records complete. Numeric activity or leave thresholds must come from current authorized leadership publications.',
        fields: [
            {
                name: 'Staff Statuses',
                value:
                    'Active, reduced availability, approved leave, inactive/unreachable, and resignation each require clear communication and responsible ownership of existing work.',
            },
            {
                name: 'Leave Workflow',
                value:
                    'Notify the authorized leader early, state the dates/duration without unnecessary private details, identify open responsibilities, confirm approval and access limits, and review changes before returning.',
            },
            {
                name: 'Responsible Handoff',
                value:
                    'Finish or transfer open scenes, complete logs and case records, identify the new owner, confirm receipt, and keep evidence only in authorized locations.',
            },
            {
                name: 'Return & Resignation',
                value:
                    'Verify restored status and permissions before returning. On departure, use the approved route, transfer records, stop privileged access, follow material-handling direction, and maintain confidentiality afterward.',
            },
            {
                name: 'Privacy',
                value:
                    'Staff should provide only what is necessary to manage availability. Leaders must limit private circumstances to people who genuinely need the information.',
            },
        ],
    },
];

const RANK_GUIDES = [
    {
        id: 'foundership',
        label: 'Foundership',
        description: 'Founder and Assistant Founder.',
        emoji: '👑',
        color: 0xf1c40f,
        ranks: [
            'Founder',
            'Assistant Founder',
        ],
        purpose:
            'Protect the long-term direction, ownership, standards, and trust of Illinois State Roleplay while ensuring the leadership structure remains accountable.',
        expectations: [
            'Maintain final oversight of community direction and staff trust.',
            'Require evidence, policy, authority, and proportionality for high-impact decisions.',
            'Protect good-faith reporting and impartial review.',
            'Model professionalism instead of relying only on rank authority.',
        ],
    },
    {
        id: 'directorate',
        label: 'Directorate',
        description: 'Director through Head of Staff.',
        emoji: '🏛️',
        color: 0xf1c40f,
        ranks: [
            'Director',
            'Assistant Director',
            'Head of Staff',
        ],
        purpose:
            'Turn community direction into consistent staff operations, supervise major escalations, and ensure high-impact decisions remain supported and documented.',
        expectations: [
            'Review directives, staffing risks, access concerns, and major escalations.',
            'Require evidence, policy, authority, and proportionality for approvals.',
            'Resolve conflicts impartially and protect good-faith reporting.',
            'Model professionalism instead of relying on rank authority.',
        ],
    },
    {
        id: 'staff_supervision',
        label: 'Staff Supervision',
        description: 'The three Staff Supervisor ranks.',
        emoji: '📋',
        color: 0x3498db,
        ranks: [
            'Head Staff Supervisor',
            'Staff Supervisor',
            'Trial Staff Supervisor',
        ],
        purpose:
            'Provide direct staff oversight, answer policy questions, coach developing staff, review significant actions, and maintain clear scene ownership.',
        expectations: [
            'Prevent duplicate moderation and establish one scene owner.',
            'Approve only actions supported by identity, evidence, policy, and authority.',
            'Coach correctable mistakes early and document recurring concerns.',
            'Escalate staff conduct, major incidents, and conflicts appropriately.',
        ],
    },
    {
        id: 'management',
        label: 'Management',
        description: 'Senior through Trial Management.',
        emoji: '📊',
        color: 0x3498db,
        ranks: [
            'Senior Management',
            'Management',
            'Trial Management',
        ],
        purpose:
            'Coordinate day-to-day staff operations, support supervision, review records and performance, and route matters to the correct authority.',
        expectations: [
            'Prevent duplicate moderation and establish clear scene ownership.',
            'Approve only actions supported by identity, evidence, policy, and authority.',
            'Coach correctable mistakes early and document recurring concerns.',
            'Escalate staff conduct, major incidents, and conflicts appropriately.',
        ],
    },
    {
        id: 'internal_affairs',
        label: 'Internal Affairs',
        description: 'IA Director through Trial IA.',
        emoji: '🔍',
        color: 0x2b2d31,
        ranks: [
            'Internal Affairs Director',
            'Internal Affairs',
            'Trial Internal Affairs',
        ],
        purpose:
            'Receive staff concerns, preserve confidential evidence, conduct impartial reviews, document factual findings, and protect fair discipline and appeals.',
        expectations: [
            'Separate allegation, evidence, finding, recommendation, and final decision.',
            'Avoid conflicts of interest and unauthorized disclosure.',
            'Protect participants from retaliation.',
            'Maintain complete records for authorized review and appeals.',
        ],
    },
    {
        id: 'administration',
        label: 'Administration',
        description: 'Head Administrator through Administrator.',
        emoji: '⚙️',
        color: 0x5865f2,
        ranks: [
            'Head Administrator',
            'Senior Administrator',
            'Administrator',
        ],
        purpose:
            'Handle advanced operational situations within assigned authority, support moderators, protect scene consistency, and ensure decisions and commands are properly documented.',
        expectations: [
            'Verify the exact player, evidence, rule, offense count, and command.',
            'Use the least disruptive authorized action.',
            'Support or accept explicit scene transfers rather than competing for control.',
            'Escalate major incidents and staff-conduct concerns promptly.',
        ],
    },
    {
        id: 'moderation',
        label: 'Moderation',
        description: 'Head Moderator through Trial Moderator.',
        emoji: '🛡️',
        color: 0x2ecc71,
        ranks: [
            'Head Moderator',
            'Senior Moderator',
            'Moderator',
            'Trial Moderator',
        ],
        purpose:
            'Respond to members, stabilize scenes, verify facts, apply the punishment matrix consistently, communicate decisions professionally, and complete accurate logs.',
        expectations: [
            'Pause and ask when evidence, syntax, permissions, or policy are uncertain.',
            'Never punish from reputation, friendship, or a single unverified claim.',
            'Respect scene ownership and avoid overlapping commands.',
            'Use exact Roblox usernames and complete every required log.',
        ],
    },
];

function getGuideSection(sectionId) {
    return (
        GUIDE_SECTIONS.find(
            (section) => section.id === sectionId
        ) || null
    );
}

function getRankGuide(guideId) {
    return (
        RANK_GUIDES.find(
            (guide) => guide.id === guideId
        ) || null
    );
}

function getStaffGuideTabUrl(tabId) {
    if (!tabId) {
        return STAFF_GUIDE_DOCUMENT_URL;
    }

    try {
        const url = new URL(STAFF_GUIDE_DOCUMENT_URL);
        url.searchParams.set('tab', tabId);
        return url.toString();
    } catch {
        return STAFF_GUIDE_DOCUMENT_URL;
    }
}

module.exports = {
    CHAIN_OF_COMMAND,
    DEFAULT_STAFF_GUIDE_DOCUMENT_URL,
    GUIDE_SECTIONS,
    RANK_GUIDES,
    STAFF_GUIDE_DOCUMENT_URL,
    getGuideSection,
    getRankGuide,
    getStaffGuideTabUrl,
};
