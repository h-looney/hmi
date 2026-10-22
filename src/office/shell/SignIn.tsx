/** Demo sign-in: pick a sample profile. A real build would use individual accounts + 2FA. */
import { useAssets } from '../assets';
import { profiles, roleLabels } from '../data/people';
import { PUBLIC_HOME } from '../router';
import { db, ui } from '../store';
import { Avatar, Badge } from '../ui/core';
import { Icon } from '../ui/Icon';
import { switchProfile } from './UserMenu';

export function SignIn() {
  const { signin, logo } = useAssets();
  return (
    <div class="signin">
      <aside class="signin__art" aria-label="About HMI mode">
        <div class="signin__art-inner">
          <img src={logo} alt="HMI Fireplace Shops" width={202} height={26} class="signin__logo" />
          <p class="signin__kicker">HMI mode</p>
          <p class="signin__headline">Everything behind the counter, in one place.</p>
          <ul class="signin__points" role="list">
            <li>
              <Icon name="inbox" size={18} /> Website requests land in a shared inbox
            </li>
            <li>
              <Icon name="clipboard" size={18} /> Installs, service and warranty work on one schedule
            </li>
            <li>
              <Icon name="box" size={18} /> Stock at both showrooms, in real time
            </li>
            <li>
              <Icon name="bank" size={18} /> Invoicing and books — in-house or synced to QuickBooks
            </li>
          </ul>
          <img class="signin__photo" src={signin} alt="" width={600} height={160} />
        </div>
      </aside>
      <main class="signin__panel" id="office-main">
        <div class="signin__box">
          <h1 class="signin__title" data-page-title tabIndex={-1}>
            Sign in to HMI Office
          </h1>
          <p class="signin__lead">This concept demo has sample profiles, each with the tools that role would use. Pick one to start — you can switch any time.</p>
          <ul class="profile-list profile-list--signin" role="list">
            {profiles.map((p) => {
              const person = db.value.staff.find((s) => s.id === p.id)!;
              return (
                <li key={p.id}>
                  <button type="button" class="profile-option profile-option--lg" onClick={() => switchProfile(person.id, { keepPage: true })}>
                    <Avatar person={person} size={44} />
                    <span>
                      <span class="profile-option__name">
                        {person.name} <span class="muted">· {roleLabels[person.role]}</span>
                        {person.id === ui.value.lastUserId && (
                          <>
                            {' '}
                            <Badge tone="ember" class="profile-option__last">
                              Last used
                            </Badge>
                          </>
                        )}
                      </span>
                      <span class="profile-option__blurb">{p.blurb}</span>
                    </span>
                    <Icon name="arrow-right" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p class="signin__note">
            <Icon name="lock" size={16} />
            <span>In production, each person signs in with their own account and two-step verification, and sees only what their role allows.</span>
          </p>
          <a class="signin__back" href={PUBLIC_HOME}>
            <Icon name="arrow-left" size={16} /> Back to the public website
          </a>
        </div>
      </main>
    </div>
  );
}
