import { FormEvent, ReactNode, useMemo, useState } from 'react';

type ModuleId =
  | 'overview'
  | 'users'
  | 'logs'
  | 'content'
  | 'shop'
  | 'community'
  | 'health'
  | 'notifications'
  | 'reports'
  | 'audit'
  | 'settings';

type Status = 'active' | 'blocked' | 'disabled' | 'draft' | 'published' | 'queued' | 'sent' | 'failed' | 'hidden';
type ModuleGroup =
  | 'Dashboard'
  | 'People & Activity'
  | 'Content & Commerce'
  | 'Engagement'
  | 'Health & Governance'
  | 'System';

export type AdminUser = {
  id: string;
  name: string;
  emailOrPhone: string;
  authProvider: 'Google' | 'Phone';
  status: 'active' | 'blocked' | 'disabled';
  childrenCount: number;
  lastActive: string;
  appVersion: string;
  consentStatus: 'accepted' | 'pending' | 'revoked';
};

export type BabyProfile = {
  id: string;
  userId: string;
  babyName: string;
  age: string;
  goals: string[];
  recentLogs: number;
  caregiverCount: number;
  profileStatus: 'complete' | 'needs review';
};

export type FeedingLog = {
  id: string;
  userId: string;
  childName: string;
  type: 'milk' | 'solid' | 'water' | 'poop' | 'timeline';
  detail: string;
  amount: string;
  time: string;
  status: 'normal' | 'flagged';
};

export type ContentItem = {
  id: string;
  kind: 'recipe' | 'guide' | 'blog' | 'poop guidance';
  title: string;
  category: string;
  metadata: string;
  status: 'draft' | 'published';
  signal: string;
};

export type Product = {
  id: string;
  name: string;
  category: 'purees' | 'snacks' | 'equipment' | 'supplements' | 'bundles';
  price: string;
  tag: string;
  status: 'active' | 'draft';
};

export type CommunityRoom = {
  id: string;
  name: string;
  members: number;
  online: number;
  status: 'open' | 'locked';
};

export type CommunityMessage = {
  id: string;
  author: string;
  room: string;
  status: 'visible' | 'hidden' | 'reported';
  likes: number;
  reports: number;
  text: string;
};

export type HealthRecordSummary = {
  id: string;
  childName: string;
  visits: number;
  growthRecords: number;
  vaccines: string;
  milestones: string;
  exports: number;
  deletionRequest: 'none' | 'pending';
};

export type NotificationJob = {
  id: string;
  type: 'feeding reminder' | 'vaccine due' | 'visit due' | 'community reply' | 'system notice';
  audience: string;
  title: string;
  scheduledFor: string;
  status: 'queued' | 'sent' | 'failed' | 'cancelled';
  delivery: string;
};

export type ReportDefinition = {
  id: string;
  name: string;
  scope: string;
  sensitive: boolean;
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  module: ModuleId;
  severity: 'info' | 'warning' | 'critical';
  date: string;
};

export type UsageMetric = {
  label: string;
  value: string;
  detail: string;
};

const modules: { id: ModuleId; label: string; metric: string; group: ModuleGroup }[] = [
  { id: 'overview', label: 'Overview', metric: 'Command', group: 'Dashboard' },
  { id: 'users', label: 'Users and Baby Profiles', metric: 'Accounts', group: 'People & Activity' },
  { id: 'logs', label: 'Logs and Daily Activity', metric: 'Logs', group: 'People & Activity' },
  { id: 'content', label: 'Content Management', metric: 'CMS', group: 'Content & Commerce' },
  { id: 'shop', label: 'Shop', metric: 'MVP cart', group: 'Content & Commerce' },
  { id: 'community', label: 'Community', metric: 'Moderation', group: 'Engagement' },
  { id: 'notifications', label: 'Push Notifications', metric: 'Transactional', group: 'Engagement' },
  { id: 'health', label: 'Nanha Yatra Health', metric: 'Guarded', group: 'Health & Governance' },
  { id: 'reports', label: 'Reports and Downloads', metric: 'Exports', group: 'Health & Governance' },
  { id: 'audit', label: 'Audit and Admin Activity', metric: 'Governance', group: 'Health & Governance' },
  { id: 'settings', label: 'Settings', metric: 'System', group: 'System' },
];

const moduleGroups: ModuleGroup[] = [
  'Dashboard',
  'People & Activity',
  'Content & Commerce',
  'Engagement',
  'Health & Governance',
  'System',
];

const initialUsers: AdminUser[] = [
  {
    id: 'usr_aarav',
    name: 'Aarav Mehta',
    emailOrPhone: 'aarav.parent@example.com',
    authProvider: 'Google',
    status: 'active',
    childrenCount: 1,
    lastActive: 'Today 09:42',
    appVersion: '0.1.0',
    consentStatus: 'accepted',
  },
  {
    id: 'usr_priya',
    name: 'Priya Rao',
    emailOrPhone: '+91 98xxxxxx12',
    authProvider: 'Phone',
    status: 'active',
    childrenCount: 2,
    lastActive: 'Yesterday 21:18',
    appVersion: '0.1.0',
    consentStatus: 'accepted',
  },
  {
    id: 'usr_meera',
    name: 'Meera Singh',
    emailOrPhone: 'meera.support@example.com',
    authProvider: 'Google',
    status: 'blocked',
    childrenCount: 1,
    lastActive: 'Jul 6, 2026',
    appVersion: '0.0.9',
    consentStatus: 'pending',
  },
];

const babyProfiles: BabyProfile[] = [
  {
    id: 'baby_iva',
    userId: 'usr_aarav',
    babyName: 'Iva',
    age: '8 months',
    goals: ['hydration', 'iron foods', 'constipation watch'],
    recentLogs: 9,
    caregiverCount: 2,
    profileStatus: 'complete',
  },
  {
    id: 'baby_rey',
    userId: 'usr_priya',
    babyName: 'Rey',
    age: '11 months',
    goals: ['texture practice', 'finger foods'],
    recentLogs: 6,
    caregiverCount: 3,
    profileStatus: 'complete',
  },
  {
    id: 'baby_kabir',
    userId: 'usr_meera',
    babyName: 'Kabir',
    age: '6 months',
    goals: ['first solids', 'allergen intro'],
    recentLogs: 1,
    caregiverCount: 1,
    profileStatus: 'needs review',
  },
];

const logs: FeedingLog[] = [
  { id: 'log_1', userId: 'usr_aarav', childName: 'Iva', type: 'milk', detail: 'Formula feed', amount: '180 ml', time: '08:10', status: 'normal' },
  { id: 'log_2', userId: 'usr_aarav', childName: 'Iva', type: 'solid', detail: 'Carrot lentil mash', amount: '70%', time: '12:30', status: 'normal' },
  { id: 'log_3', userId: 'usr_priya', childName: 'Rey', type: 'water', detail: 'Sippy cup', amount: '90 ml', time: '14:05', status: 'normal' },
  { id: 'log_4', userId: 'usr_meera', childName: 'Kabir', type: 'poop', detail: 'Type 2, hard stool', amount: '1 event', time: '18:20', status: 'flagged' },
  { id: 'log_5', userId: 'usr_priya', childName: 'Rey', type: 'timeline', detail: 'Evening snack reminder', amount: 'completed', time: '19:00', status: 'normal' },
];

const initialContent: ContentItem[] = [
  { id: 'cnt_1', kind: 'recipe', title: 'Carrot Lentil Bowl', category: 'Iron rich', metadata: '8m+ | mashed | constipation friendly', status: 'published', signal: '1,248 favourites' },
  { id: 'cnt_2', kind: 'guide', title: 'Stage 2 Weaning Guide', category: 'Weaning', metadata: 'milk needs, meal frequency, portions, allergens, hydration', status: 'published', signal: 'Updated Jul 8' },
  { id: 'cnt_3', kind: 'blog', title: 'Monsoon Hydration Journal', category: 'Journal', metadata: '4 min read | Dr. review pending', status: 'draft', signal: 'Needs reviewer' },
  { id: 'cnt_4', kind: 'poop guidance', title: 'Constipation Rescue', category: 'Poop diagnostics', metadata: 'Type 1-2 meaning, fiber bridge, hydration alert', status: 'published', signal: 'Educational disclaimer active' },
];

const products: Product[] = [
  { id: 'prd_1', name: 'Starter Puree Pack', category: 'purees', price: 'Rs 349', tag: 'best for 6m+', status: 'active' },
  { id: 'prd_2', name: 'Soft Silicone Spoon Set', category: 'equipment', price: 'Rs 299', tag: 'top cart add', status: 'active' },
  { id: 'prd_3', name: 'Gentle Millet Snack', category: 'snacks', price: 'Rs 189', tag: 'texture practice', status: 'draft' },
  { id: 'prd_4', name: 'Weaning Starter Bundle', category: 'bundles', price: 'Rs 899', tag: 'bundle MVP', status: 'active' },
];

const rooms: CommunityRoom[] = [
  { id: 'room_1', name: 'Constipation Care Circle', members: 284, online: 18, status: 'open' },
  { id: 'room_2', name: 'First Foods Support', members: 512, online: 44, status: 'open' },
  { id: 'room_3', name: 'Nanha Yatra Parents', members: 96, online: 7, status: 'locked' },
];

const messages: CommunityMessage[] = [
  { id: 'msg_1', author: 'Priya Rao', room: 'Constipation Care Circle', status: 'reported', likes: 12, reports: 2, text: 'What helped your baby with hard stool?' },
  { id: 'msg_2', author: 'Aarav Mehta', room: 'First Foods Support', status: 'visible', likes: 7, reports: 0, text: 'Iva liked the carrot lentil mash today.' },
];

const healthRecords: HealthRecordSummary[] = [
  { id: 'hlth_1', childName: 'Iva', visits: 3, growthRecords: 5, vaccines: '2 due soon', milestones: 'Crawling observed', exports: 1, deletionRequest: 'none' },
  { id: 'hlth_2', childName: 'Rey', visits: 5, growthRecords: 8, vaccines: 'up to date', milestones: 'Standing with support', exports: 0, deletionRequest: 'pending' },
];

const initialNotifications: NotificationJob[] = [
  { id: 'ntf_1', type: 'feeding reminder', audience: 'Parents with missed lunch log', title: 'Lunch log reminder', scheduledFor: 'Today 13:00', status: 'queued', delivery: '0 sent / 0 failed' },
  { id: 'ntf_2', type: 'vaccine due', audience: 'Children with vaccine due in 7 days', title: 'Vaccine visit due soon', scheduledFor: 'Jul 10, 2026 09:00', status: 'sent', delivery: '212 sent / 3 skipped' },
  { id: 'ntf_3', type: 'system notice', audience: 'All active users', title: 'Nanha Yatra export maintenance', scheduledFor: 'Jul 11, 2026 18:00', status: 'failed', delivery: '0 sent / 14 failed' },
];

const reports: ReportDefinition[] = [
  { id: 'rep_1', name: 'users CSV', scope: 'User status, provider, consent, app version', sensitive: false },
  { id: 'rep_2', name: 'baby profiles CSV', scope: 'Profile completeness and goals', sensitive: false },
  { id: 'rep_3', name: 'feeding logs CSV', scope: 'Milk, solids, water, poop, and timeline', sensitive: false },
  { id: 'rep_4', name: 'content inventory', scope: 'Recipes, guides, blogs, poop guidance', sensitive: false },
  { id: 'rep_5', name: 'shop products', scope: 'MVP cart product catalog', sensitive: false },
  { id: 'rep_6', name: 'community moderation report', scope: 'Rooms, reports, hidden messages', sensitive: false },
  { id: 'rep_7', name: 'notification delivery report', scope: 'FCM queue delivery counts', sensitive: false },
  { id: 'rep_8', name: 'audit log export', scope: 'Admin actions and sensitive access', sensitive: true },
  { id: 'rep_9', name: 'Nanha Yatra health summary export', scope: 'Reason-gated health summaries only', sensitive: true },
];

const auditEvents: AuditEvent[] = [
  { id: 'aud_1', actor: 'super-admin@numnam.local', action: 'Reason-gated health access approved', module: 'health', severity: 'critical', date: 'Today 10:12' },
  { id: 'aud_2', actor: 'editor@numnam.local', action: 'Published Stage 2 Weaning Guide', module: 'content', severity: 'info', date: 'Yesterday 16:20' },
  { id: 'aud_3', actor: 'super-admin@numnam.local', action: 'Admin role changed for moderator queue', module: 'audit', severity: 'warning', date: 'Jul 7, 2026' },
  { id: 'aud_4', actor: 'system', action: 'Notification send failed and retry required', module: 'notifications', severity: 'warning', date: 'Jul 7, 2026' },
];

const usageMetrics: UsageMetric[] = [
  { label: 'Daily active users', value: '1,284', detail: '+8% vs yesterday' },
  { label: 'Weekly active users', value: '5,902', detail: '64% 7-day return' },
  { label: 'Top active screen', value: 'Today', detail: '42% of sessions' },
  { label: 'Retention pulse', value: 'D7 38%', detail: 'Mock cohort card' },
];

const lower = (value: unknown) => String(value).toLowerCase();

function matchesQuery(query: string, ...values: unknown[]) {
  const trimmed = query.trim().toLowerCase();
  return !trimmed || values.some((value) => lower(value).includes(trimmed));
}

function statusClass(status: Status | string) {
  return `status-pill ${String(status).replace(/\s+/g, '-').toLowerCase()}`;
}

function EmptyState({ query }: { query: string }) {
  return <p className="empty-state">No dashboard records match "{query}".</p>;
}

function StatusPill({ value }: { value: Status | string }) {
  return <span className={statusClass(value)}>{value}</span>;
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-action" type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function ModuleHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="module-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail }: UsageMetric) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState(initialUsers);
  const [content, setContent] = useState(initialContent);
  const [notificationJobs, setNotificationJobs] = useState(initialNotifications);
  const [notificationTitle, setNotificationTitle] = useState('Scheduled test notification');
  const [notificationType, setNotificationType] = useState<NotificationJob['type']>('feeding reminder');
  const [healthReason, setHealthReason] = useState('');
  const [healthUnlocked, setHealthUnlocked] = useState(false);
  const [notice, setNotice] = useState('Local mock mode: no Firebase, Convex, FCM, or real downloads are connected.');
  const activeModuleLabel = modules.find((module) => module.id === activeModule)?.label ?? 'Overview';

  const filteredUsers = users.filter((user) =>
    matchesQuery(query, user.name, user.emailOrPhone, user.authProvider, user.status, user.consentStatus),
  );
  const filteredBabies = babyProfiles.filter((baby) =>
    matchesQuery(query, baby.babyName, baby.age, baby.goals.join(' '), baby.profileStatus),
  );
  const filteredLogs = logs.filter((log) =>
    matchesQuery(query, log.childName, log.type, log.detail, log.amount, log.status),
  );
  const filteredContent = content.filter((item) =>
    matchesQuery(query, item.title, item.kind, item.category, item.metadata, item.status),
  );
  const filteredProducts = products.filter((product) =>
    matchesQuery(query, product.name, product.category, product.price, product.tag, product.status),
  );
  const filteredMessages = messages.filter((message) =>
    matchesQuery(query, message.author, message.room, message.status, message.text),
  );
  const filteredRooms = rooms.filter((room) => matchesQuery(query, room.name, room.status, room.members, room.online));
  const filteredReports = reports.filter((report) => matchesQuery(query, report.name, report.scope));
  const filteredAudits = auditEvents.filter((event) =>
    matchesQuery(query, event.actor, event.action, event.module, event.severity),
  );

  const overviewMetrics = useMemo(
    () => [
      { label: 'Total users', value: String(users.length), detail: 'Mock parent accounts' },
      { label: 'Active users', value: String(users.filter((user) => user.status === 'active').length), detail: 'Can open app today' },
      { label: 'Baby profiles', value: String(babyProfiles.length), detail: 'Profiles in local fixtures' },
      { label: 'Logs today', value: String(logs.length), detail: 'Milk, solid, water, poop, timeline' },
      { label: 'Queued notifications', value: String(notificationJobs.filter((job) => job.status === 'queued').length), detail: 'Transactional queue only' },
      { label: 'Pending reports', value: String(reports.filter((report) => report.sensitive).length), detail: 'Sensitive exports require reason' },
    ],
    [notificationJobs, users],
  );

  function setUserStatus(userId: string, status: AdminUser['status']) {
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, status } : user)));
    setNotice(`User status changed to ${status} locally. Audit will be recorded after backend integration.`);
  }

  function toggleContentStatus(itemId: string) {
    setContent((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, status: item.status === 'published' ? 'draft' : 'published' } : item,
      ),
    );
    setNotice('Content publish state updated locally. No CMS backend call was made.');
  }

  function scheduleNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = notificationTitle.trim() || 'Scheduled test notification';
    setNotificationJobs((current) => [
      {
        id: `ntf_${current.length + 1}`,
        type: notificationType,
        audience: 'Selected mock segment',
        title,
        scheduledFor: 'Next available slot',
        status: 'queued',
        delivery: '0 sent / 0 failed',
      },
      ...current,
    ]);
    setNotice(`Notification "${title}" scheduled locally.`);
  }

  function renderOverview() {
    return (
      <>
        <ModuleHeader
          title="Overview"
          description="Operational pulse across users, content, shop, community, health privacy, notifications, reports, and app activity."
        />
        <section className="metric-grid">
          {overviewMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>
        <section className="panel-grid">
          <article className="panel">
            <h2>Usage snapshot</h2>
            <div className="metric-grid compact">
              {usageMetrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>
          </article>
          <article className="panel">
            <h2>Operational alerts</h2>
            <ul className="feed-list">
              <li>Pending moderation: 2 reported community messages</li>
              <li>Health access requests: reason gate active for Nanha Yatra</li>
              <li>Failed notifications: 1 system notice needs retry</li>
              <li>Unpublished content: Monsoon Hydration Journal needs review</li>
            </ul>
          </article>
        </section>
      </>
    );
  }

  function renderUsers() {
    return (
      <>
        <ModuleHeader title="Users and Baby Profiles" description="Support account state, consent, app version, children, goals, and export mocks." />
        <section className="panel">
          <div className="panel-title-row">
            <h2>User table</h2>
            <ActionButton onClick={() => setNotice('User summary export prepared locally.')}>Export user summary</ActionButton>
          </div>
          {filteredUsers.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email / phone</th>
                    <th>Auth</th>
                    <th>Status</th>
                    <th>Children</th>
                    <th>Last active</th>
                    <th>App</th>
                    <th>Consent</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.emailOrPhone}</td>
                      <td>{user.authProvider}</td>
                      <td><StatusPill value={user.status} /></td>
                      <td>{user.childrenCount}</td>
                      <td>{user.lastActive}</td>
                      <td>{user.appVersion}</td>
                      <td>{user.consentStatus}</td>
                      <td className="action-cell">
                        <ActionButton onClick={() => setNotice(`Viewing ${user.name} details locally.`)}>View</ActionButton>
                        {user.status === 'active' ? (
                          <ActionButton onClick={() => setUserStatus(user.id, 'disabled')}>Disable</ActionButton>
                        ) : (
                          <ActionButton onClick={() => setUserStatus(user.id, 'active')}>Restore</ActionButton>
                        )}
                        <ActionButton onClick={() => setUserStatus(user.id, 'blocked')}>Block</ActionButton>
                        <ActionButton onClick={() => setNotice(`Support note marked for ${user.name}.`)}>Support note</ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState query={query} />
          )}
        </section>
        <section className="panel">
          <h2>Baby profile panel</h2>
          <div className="card-grid">
            {filteredBabies.map((baby) => (
              <article className="data-card" key={baby.id}>
                <div className="panel-title-row">
                  <h3>{baby.babyName}</h3>
                  <StatusPill value={baby.profileStatus} />
                </div>
                <p>{baby.age} · {baby.caregiverCount} caregivers · {baby.recentLogs} recent logs</p>
                <div className="chip-row">
                  {baby.goals.map((goal) => (
                    <span className="chip" key={goal}>{goal}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderLogs() {
    return (
      <>
        <ModuleHeader title="Logs and Daily Activity" description="Milk, solid food, water, poop, and timeline activity with local filtering and export confirmations." />
        <section className="metric-grid">
          <MetricCard label="Milk total" value="180 ml" detail="Latest mock total" />
          <MetricCard label="Solid completion" value="70%" detail="Carrot lentil mash" />
          <MetricCard label="Water total" value="90 ml" detail="Across visible logs" />
          <MetricCard label="Latest poop" value="Type 2" detail="Flagged educational constipation watch" />
        </section>
        <section className="panel">
          <div className="panel-title-row">
            <h2>Daily log table</h2>
            <div className="action-row">
              <select aria-label="Log type filter" defaultValue="all">
                <option value="all">All log types</option>
                <option value="milk">Milk</option>
                <option value="solid">Solid</option>
                <option value="water">Water</option>
                <option value="poop">Poop</option>
              </select>
              <ActionButton onClick={() => setNotice('Feeding logs CSV export prepared locally.')}>Export logs report</ActionButton>
              <ActionButton onClick={() => setNotice('Clear today confirmation shown locally.')}>Clear today</ActionButton>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Child</th><th>Type</th><th>Detail</th><th>Amount</th><th>Time</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.childName}</td>
                    <td>{log.type}</td>
                    <td>{log.detail}</td>
                    <td>{log.amount}</td>
                    <td>{log.time}</td>
                    <td><StatusPill value={log.status} /></td>
                    <td className="action-cell">
                      <ActionButton onClick={() => setNotice(`Viewing ${log.type} log for ${log.childName}.`)}>View</ActionButton>
                      <ActionButton onClick={() => setNotice(`${log.type} log flagged locally.`)}>Flag</ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderContent() {
    return (
      <>
        <ModuleHeader title="Content Management" description="Recipes, weaning guide, blog/journal, and poop guidance inventory with frontend-only publishing controls." />
        <section className="panel">
          <div className="panel-title-row">
            <h2>Content inventory</h2>
            <ActionButton onClick={() => setNotice('Add content drawer opened locally.')}>Add content</ActionButton>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Type</th><th>Title</th><th>Category</th><th>Metadata</th><th>Status</th><th>Signal</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredContent.map((item) => (
                  <tr key={item.id}>
                    <td>{item.kind}</td>
                    <td>{item.title}</td>
                    <td>{item.category}</td>
                    <td>{item.metadata}</td>
                    <td><StatusPill value={item.status} /></td>
                    <td>{item.signal}</td>
                    <td className="action-cell">
                      <ActionButton onClick={() => setNotice(`Editing ${item.title} locally.`)}>Edit</ActionButton>
                      <ActionButton onClick={() => toggleContentStatus(item.id)}>
                        {item.status === 'published' ? 'Unpublish' : 'Publish'}
                      </ActionButton>
                      <ActionButton onClick={() => setNotice(`Delete confirmation shown for ${item.title}.`)}>Delete</ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderShop() {
    return (
      <>
        <ModuleHeader title="Shop" description="MVP product catalog and cart analytics only. No payment, delivery, invoices, order tracking, or inventory automation." />
        <section className="metric-grid">
          <MetricCard label="Cart starts" value="312" detail="Mock MVP cart analytics" />
          <MetricCard label="Cart saves" value="184" detail="No checkout in scope" />
          <MetricCard label="Top product" value="Spoon Set" detail="Soft Silicone Spoon Set" />
        </section>
        <section className="card-grid">
          {filteredProducts.map((product) => (
            <article className="data-card" key={product.id}>
              <div className="panel-title-row">
                <h3>{product.name}</h3>
                <StatusPill value={product.status} />
              </div>
              <p>{product.category} · {product.price}</p>
              <span className="chip">{product.tag}</span>
              <ActionButton onClick={() => setNotice(`${product.name} product detail opened locally.`)}>View product</ActionButton>
            </article>
          ))}
        </section>
      </>
    );
  }

  function renderCommunity() {
    return (
      <>
        <ModuleHeader title="Community" description="Rooms, seeded messages, moderation actions, and a local guidelines editor mock." />
        <section className="panel-grid">
          <article className="panel">
            <h2>Rooms</h2>
            <div className="card-grid single">
              {filteredRooms.map((room) => (
                <article className="data-card" key={room.id}>
                  <div className="panel-title-row">
                    <h3>{room.name}</h3>
                    <StatusPill value={room.status} />
                  </div>
                  <p>{room.members} members · {room.online} online</p>
                  <ActionButton onClick={() => setNotice(`${room.name} lock state changed locally.`)}>Lock room</ActionButton>
                </article>
              ))}
            </div>
          </article>
          <article className="panel">
            <h2>Guidelines editor</h2>
            <textarea aria-label="Guidelines editor" defaultValue="Be kind, avoid medical claims, and recommend professional care for urgent symptoms." />
            <ActionButton onClick={() => setNotice('Community guidelines saved locally.')}>Save guidelines</ActionButton>
          </article>
        </section>
        <section className="panel">
          <h2>Message moderation</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Author</th><th>Room</th><th>Message</th><th>Status</th><th>Likes</th><th>Reports</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredMessages.map((message) => (
                  <tr key={message.id}>
                    <td>{message.author}</td>
                    <td>{message.room}</td>
                    <td>{message.text}</td>
                    <td><StatusPill value={message.status} /></td>
                    <td>{message.likes}</td>
                    <td>{message.reports}</td>
                    <td className="action-cell">
                      <ActionButton onClick={() => setNotice(`Message by ${message.author} hidden locally.`)}>Hide message</ActionButton>
                      <ActionButton onClick={() => setNotice(`Message by ${message.author} restored locally.`)}>Restore</ActionButton>
                      <ActionButton onClick={() => setNotice(`Delete confirmation shown for message by ${message.author}.`)}>Delete</ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderHealth() {
    return (
      <>
        <ModuleHeader title="Nanha Yatra Health" description="Privacy-first super-admin view with reason-gated access and audit warning on every sensitive action." />
        <section className="metric-grid">
          <MetricCard label="Visits" value="8" detail="Across visible summaries" />
          <MetricCard label="Growth records" value="13" detail="Private child data summaries" />
          <MetricCard label="Vaccines" value="2 due" detail="Reference reminders only" />
          <MetricCard label="Deletion requests" value="1" detail="Requires audit trail" />
        </section>
        <section className="panel guarded-panel">
          <h2>Reason-gated child health detail</h2>
          <p>Raw child health detail is hidden until the super admin records a support, legal, or safety reason. Audit will be recorded.</p>
          {!healthUnlocked ? (
            <form className="reason-form" onSubmit={(event) => {
              event.preventDefault();
              if (!healthReason.trim()) {
                setNotice('Enter a reason before unlocking health detail.');
                return;
              }
              setHealthUnlocked(true);
              setNotice('Health detail unlocked locally. Audit will be recorded after backend integration.');
            }}>
              <label htmlFor="health-reason">Reason for health access</label>
              <input
                id="health-reason"
                value={healthReason}
                onChange={(event) => setHealthReason(event.target.value)}
                placeholder="Support ticket, legal request, or safety review"
              />
              <button type="submit">Unlock health view</button>
            </form>
          ) : (
            <div>
              <strong>Raw health detail unlocked</strong>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Child</th><th>Visits</th><th>Growth</th><th>Vaccines</th><th>Milestones</th><th>Exports</th><th>Delete request</th><th>Actions</th></tr></thead>
                  <tbody>
                    {healthRecords.map((record) => (
                      <tr key={record.id}>
                        <td>{record.childName}</td>
                        <td>{record.visits}</td>
                        <td>{record.growthRecords}</td>
                        <td>{record.vaccines}</td>
                        <td>{record.milestones}</td>
                        <td>{record.exports}</td>
                        <td>{record.deletionRequest}</td>
                        <td className="action-cell">
                          <ActionButton onClick={() => setNotice('Health summary download prepared locally. Audit will be recorded.')}>Download health summary</ActionButton>
                          <ActionButton onClick={() => setNotice('Deletion request approval mocked locally. Audit will be recorded.')}>Approve delete</ActionButton>
                          <ActionButton onClick={() => setNotice('Vaccine reference marked updated locally. Audit will be recorded.')}>Mark reference updated</ActionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </>
    );
  }

  function renderNotifications() {
    return (
      <>
        <ModuleHeader title="Push Notifications" description="Transactional notification composer for Firebase FCM integration later. Marketing broadcasts stay out of scope." />
        <section className="panel">
          <h2>Composer</h2>
          <form className="composer-grid" onSubmit={scheduleNotification}>
            <label>Type<select value={notificationType} onChange={(event) => setNotificationType(event.target.value as NotificationJob['type'])}>
              <option value="feeding reminder">Feeding reminder</option>
              <option value="vaccine due">Vaccine due</option>
              <option value="visit due">Visit due</option>
              <option value="community reply">Community reply</option>
              <option value="system notice">System notice</option>
            </select></label>
            <label>Audience<input defaultValue="Parents with due reminder" /></label>
            <label>Title<input value={notificationTitle} onChange={(event) => setNotificationTitle(event.target.value)} /></label>
            <label>Body<input defaultValue="A gentle reminder from NumNam." /></label>
            <label>Scheduled date/time<input defaultValue="2026-07-10 09:00" /></label>
            <label>Deep link<input defaultValue="numnam://today" /></label>
            <label>Priority<select defaultValue="normal"><option>normal</option><option>high</option></select></label>
            <button type="submit">Schedule notification</button>
          </form>
        </section>
        <section className="panel">
          <h2>Queue</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Audience</th><th>Title</th><th>Scheduled</th><th>Status</th><th>Delivery</th><th>Actions</th></tr></thead>
              <tbody>
                {notificationJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.type}</td>
                    <td>{job.audience}</td>
                    <td>{job.title}</td>
                    <td>{job.scheduledFor}</td>
                    <td><StatusPill value={job.status} /></td>
                    <td>{job.delivery}</td>
                    <td className="action-cell">
                      <ActionButton onClick={() => setNotice(`Previewing ${job.title} locally.`)}>Preview</ActionButton>
                      <ActionButton onClick={() => setNotice(`${job.title} cancelled locally.`)}>Cancel</ActionButton>
                      <ActionButton onClick={() => setNotice(`${job.title} retry queued locally.`)}>Retry failed</ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderReports() {
    return (
      <>
        <ModuleHeader title="Reports and Downloads" description="Mock download center for future CSV/export flows. Sensitive exports require reason-gated handling." />
        <section className="card-grid">
          {filteredReports.map((report) => (
            <article className="data-card" key={report.id}>
              <div className="panel-title-row">
                <h3>{report.name}</h3>
                <StatusPill value={report.sensitive ? 'reason required' : 'ready'} />
              </div>
              <p>{report.scope}</p>
              <ActionButton onClick={() => setNotice(`${report.name} download prepared locally${report.sensitive ? ' with reason gate.' : '.'}`)}>
                Download {report.name}
              </ActionButton>
            </article>
          ))}
        </section>
      </>
    );
  }

  function renderAudit() {
    return (
      <>
        <ModuleHeader title="Audit and Admin Activity" description="Super-admin-only activity table for role changes, content publishes, notification sends, health access, exports, and deletes." />
        <section className="panel super-admin-panel">
          <div className="panel-title-row">
            <h2>Admin events</h2>
            <select aria-label="Audit severity filter" defaultValue="all"><option>all</option><option>critical</option><option>warning</option><option>info</option></select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Actor</th><th>Action</th><th>Module</th><th>Severity</th><th>Date</th></tr></thead>
              <tbody>
                {filteredAudits.map((event) => (
                  <tr key={event.id}>
                    <td>{event.actor}</td>
                    <td>{event.action}</td>
                    <td>{event.module}</td>
                    <td><StatusPill value={event.severity} /></td>
                    <td>{event.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        <ModuleHeader title="Settings" description="Future integration status placeholders and super-admin control boundaries." />
        <section className="panel-grid">
          {[
            ['Firebase Auth', 'Placeholder for Phone and Google auth provider status.'],
            ['Firebase Cloud Messaging', 'Placeholder for FCM token health, delivery failures, and push config.'],
            ['Convex backend', 'Placeholder for deployment, schema, function health, and audit append status.'],
            ['App version and build info', 'Mobile 0.1.0, admin 0.1.0, local mock data only.'],
            ['Legal and privacy content', 'Terms, privacy policy, consent notices, and deletion workflows need owner review.'],
            ['Super admin role control', 'Super admin can control every module, with reason gates around sensitive health records.'],
          ].map(([title, detail]) => (
            <article className="panel" key={title}>
              <h2>{title}</h2>
              <p>{detail}</p>
            </article>
          ))}
        </section>
      </>
    );
  }

  function renderActiveModule() {
    if (activeModule === 'overview') return renderOverview();
    if (activeModule === 'users') return renderUsers();
    if (activeModule === 'logs') return renderLogs();
    if (activeModule === 'content') return renderContent();
    if (activeModule === 'shop') return renderShop();
    if (activeModule === 'community') return renderCommunity();
    if (activeModule === 'health') return renderHealth();
    if (activeModule === 'notifications') return renderNotifications();
    if (activeModule === 'reports') return renderReports();
    if (activeModule === 'audit') return renderAudit();
    return renderSettings();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Admin navigation">
        <div className="brand-lockup">
          <img src="/numnam-logo.png" alt="NumNam logo" />
          <div>
            <strong>NumNam</strong>
            <span>Super admin panel</span>
          </div>
        </div>
        <nav className="module-nav" aria-label="Dashboard modules">
          {moduleGroups.map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-group-label">{group}</p>
              {modules
                .filter((module) => module.group === group)
                .map((module) => (
                  <button
                    key={module.id}
                    className={module.id === activeModule ? 'active' : ''}
                    type="button"
                    aria-current={module.id === activeModule ? 'page' : undefined}
                    onClick={() => setActiveModule(module.id)}
                  >
                    <span>{module.label}</span>
                    <small>{module.metric}</small>
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="admin-avatar" aria-hidden="true">SA</span>
          <div>
            <strong>Super admin</strong>
            <span>Full local access</span>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="workspace-label">Workspace</p>
            <strong>{activeModuleLabel}</strong>
          </div>
          <label className="global-search">
            <span className="visually-hidden">Global search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users, logs, content, products..." />
          </label>
        </header>
        <div className="notice" role="status">{notice}</div>
        {renderActiveModule()}
      </section>
    </main>
  );
}

export { matchesQuery, modules };
