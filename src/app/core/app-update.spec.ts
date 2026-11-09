import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdate } from './app-update';

describe('AppUpdate', () => {
  const versionUpdates = new Subject<VersionEvent>();

  function setup(isEnabled: boolean): AppUpdate {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled,
            versionUpdates,
            unrecoverable: new Subject(),
            checkForUpdate: () => Promise.resolve(false),
          },
        },
      ],
    });
    return TestBed.inject(AppUpdate);
  }

  const version = { hash: 'a' };

  it('becomes ready once a new version is downloaded', () => {
    const update = setup(true);
    versionUpdates.next({ type: 'VERSION_DETECTED', version });
    expect(update.ready()).toBe(false);
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: version,
      latestVersion: { hash: 'b' },
    });
    expect(update.ready()).toBe(true);
    update.dismiss();
    expect(update.ready()).toBe(false);
  });

  it('stays idle when the service worker is disabled', () => {
    const update = setup(false);
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: version,
      latestVersion: { hash: 'b' },
    });
    expect(update.ready()).toBe(false);
  });
});
