import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App, matchesQuery, modules } from './App';

async function openModule(name: RegExp | string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name }));
  return user;
}

describe('admin dashboard frontend', () => {
  it('renders sidebar navigation for all major modules', () => {
    render(<App />);

    expect(screen.getByRole('img', { name: 'NumNam logo' })).toHaveAttribute('src', '/numnam-logo.png');
    expect(screen.getByRole('navigation', { name: 'Dashboard modules' })).toBeInTheDocument();
    expect(screen.getByText('People & Activity')).toBeInTheDocument();
    expect(screen.getByText('Content & Commerce')).toBeInTheDocument();
    expect(screen.getByText('Health & Governance')).toBeInTheDocument();

    for (const module of modules) {
      expect(screen.getByRole('button', { name: new RegExp(module.label, 'i') })).toBeInTheDocument();
    }
  });

  it('updates the sticky workspace context when switching modules', async () => {
    render(<App />);

    await openModule(/Push Notifications/i);

    expect(screen.getAllByText('Push Notifications').length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: /Push Notifications/i })).toHaveAttribute('aria-current', 'page');
  });

  it('shows overview metrics, usage, and operational alerts', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('Active users')).toBeInTheDocument();
    expect(screen.getByText('Baby profiles')).toBeInTheDocument();
    expect(screen.getByText('Logs today')).toBeInTheDocument();
    expect(screen.getByText('Queued notifications')).toBeInTheDocument();
    expect(screen.getByText('Daily active users')).toBeInTheDocument();
    expect(screen.getByText(/Pending moderation/i)).toBeInTheDocument();
  });

  it('shows user and baby profile data and local account actions', async () => {
    render(<App />);
    const user = await openModule(/Users and Baby Profiles/i);

    expect(screen.getByText('Aarav Mehta')).toBeInTheDocument();
    expect(screen.getByText('Priya Rao')).toBeInTheDocument();
    expect(screen.getByText('Iva')).toBeInTheDocument();
    expect(screen.getByText('Kabir')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Disable' })[0]);
    expect(screen.getByText(/User status changed to disabled locally/i)).toBeInTheDocument();
  });

  it('shows milk, solid, water, poop, and timeline logs with export actions', async () => {
    render(<App />);
    const user = await openModule(/Logs and Daily Activity/i);

    expect(screen.getByRole('heading', { name: 'Logs and Daily Activity' })).toBeInTheDocument();
    expect(screen.getAllByText('milk')[0]).toBeInTheDocument();
    expect(screen.getAllByText('solid')[0]).toBeInTheDocument();
    expect(screen.getAllByText('water')[0]).toBeInTheDocument();
    expect(screen.getAllByText('poop')[0]).toBeInTheDocument();
    expect(screen.getByText('timeline')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Export logs report' }));
    expect(screen.getByText(/Feeding logs CSV export prepared locally/i)).toBeInTheDocument();
  });

  it('shows recipes, guides, blogs, poop guidance, and content actions', async () => {
    render(<App />);
    const user = await openModule(/Content Management/i);

    expect(screen.getByText('Carrot Lentil Bowl')).toBeInTheDocument();
    expect(screen.getByText('Stage 2 Weaning Guide')).toBeInTheDocument();
    expect(screen.getByText('Monsoon Hydration Journal')).toBeInTheDocument();
    expect(screen.getByText('Constipation Rescue')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByText(/Content publish state updated locally/i)).toBeInTheDocument();
  });

  it('shows shop products and MVP cart analytics only', async () => {
    render(<App />);
    await openModule(/Shop MVP cart/i);

    expect(screen.getByText('Starter Puree Pack')).toBeInTheDocument();
    expect(screen.getAllByText('Soft Silicone Spoon Set').length).toBeGreaterThan(0);
    expect(screen.getByText('Cart starts')).toBeInTheDocument();
    expect(screen.getByText(/No payment, delivery, invoices/i)).toBeInTheDocument();
  });

  it('shows community rooms, messages, and moderation actions', async () => {
    render(<App />);
    const user = await openModule(/Community Moderation/i);

    expect(screen.getAllByText('Constipation Care Circle').length).toBeGreaterThan(0);
    expect(screen.getAllByText('First Foods Support').length).toBeGreaterThan(0);
    expect(screen.getByText(/What helped your baby/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Hide message' })[0]);
    expect(screen.getByText(/hidden locally/i)).toBeInTheDocument();
  });

  it('requires a reason before showing raw Nanha Yatra health details', async () => {
    render(<App />);
    const user = await openModule(/Nanha Yatra Health/i);

    expect(screen.queryByText('Raw health detail unlocked')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unlock health view' }));
    expect(screen.getByText(/Enter a reason/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Reason for health access'), 'Support ticket NY-104');
    await user.click(screen.getByRole('button', { name: 'Unlock health view' }));
    expect(screen.getByText('Raw health detail unlocked')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Download health summary' }).length).toBeGreaterThan(0);
  });

  it('can schedule a mock transactional notification', async () => {
    render(<App />);
    const user = await openModule(/Push Notifications/i);

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Water reminder');
    await user.click(screen.getByRole('button', { name: 'Schedule notification' }));

    expect(screen.getAllByText('Water reminder')[0]).toBeInTheDocument();
    expect(screen.getByText(/Notification "Water reminder" scheduled locally/i)).toBeInTheDocument();
  });

  it('shows report downloads and mock export feedback', async () => {
    render(<App />);
    const user = await openModule(/Reports and Downloads/i);

    expect(screen.getByText('users CSV')).toBeInTheDocument();
    expect(screen.getByText('Nanha Yatra health summary export')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download users CSV' }));
    expect(screen.getByText(/users CSV download prepared locally/i)).toBeInTheDocument();
  });

  it('shows health access and admin action audit events', async () => {
    render(<App />);
    await openModule(/Audit and Admin Activity/i);

    expect(screen.getByText('Reason-gated health access approved')).toBeInTheDocument();
    expect(screen.getByText('Admin role changed for moderator queue')).toBeInTheDocument();
  });

  it('global search filters visible dashboard data', async () => {
    render(<App />);
    const user = await openModule(/Users and Baby Profiles/i);

    await user.type(screen.getByLabelText('Global search'), 'Iva');
    expect(screen.getByText('Iva')).toBeInTheDocument();
    expect(screen.queryByText('Kabir')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Global search'));
    await user.type(screen.getByLabelText('Global search'), 'zzzz');
    expect(screen.getAllByText(/No dashboard records match/i).length).toBeGreaterThan(0);
  });

  it('matches dashboard records case-insensitively', () => {
    expect(matchesQuery('spoon', 'Soft Silicone Spoon Set')).toBe(true);
    expect(matchesQuery('vaccine', 'Vaccine visit due soon')).toBe(true);
    expect(matchesQuery('missing', 'Carrot Lentil Bowl')).toBe(false);
  });
});
