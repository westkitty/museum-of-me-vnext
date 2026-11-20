import * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { CollisionWorld } from '../CollisionWorld';
import type { ExhibitControl } from '../../exhibits/contract';
import { canRenderText, createFallbackTexture, createTextTexture } from '../../assets/TextTexture';
import { GROUND_Y, TICKET_KIOSK_POSITION } from '../layout';

/** Interaction id the kiosk registers under (not an exhibit). */
export const TICKET_KIOSK_ID = 'ticket-kiosk';

/**
 * The admissions kiosk on the forecourt, just before the doors. A visitor
 * takes a ticket here instead of pressing an "Enter" button: the museum's
 * interior is prepared while the ticket prints, so the loading is the
 * interaction. Built from core modules only — the exterior boot must not pull
 * in the exhibit chunk (tests/browser/exterior-first.e2e.ts).
 */
export class TicketKiosk {
  readonly group = new THREE.Group();
  private ticket: THREE.Mesh | null = null;
  private screen: THREE.Mesh | null = null;
  private screenIdle: THREE.Texture | null = null;
  private screenDone: THREE.Texture | null = null;
  private issuedAt = -1;
  private elapsed = 0;

  constructor(private readonly scope: ResourceScope, private readonly collision: CollisionWorld) {
    this.group.name = 'ticket-kiosk';
    this.group.userData.visualRole = 'admissions-kiosk';
  }

  build(onTake: () => void, isIssued: () => boolean): { group: THREE.Group; control: ExhibitControl } {
    const s = this.scope;
    const [x, , z] = TICKET_KIOSK_POSITION;
    this.group.position.set(x, GROUND_Y, z);
    // Face the approach path (south, turned a little toward the door axis).
    this.group.rotation.y = -0.45;

    const bronze = s.track(new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.45, metalness: 0.7 }));
    const brass = s.track(new THREE.MeshStandardMaterial({ color: 0xc9a24f, roughness: 0.32, metalness: 0.85 }));
    const glow = s.track(new THREE.MeshBasicMaterial({ color: 0xffc98a, toneMapped: false }));
    const paper = s.track(new THREE.MeshStandardMaterial({ color: 0xf1e7cf, roughness: 0.9, metalness: 0 }));

    const mesh = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number]) => {
      const m = new THREE.Mesh(s.track(geo), mat);
      m.name = name;
      m.position.set(...p);
      m.castShadow = true;
      this.group.add(m);
      return m;
    };

    mesh('ticket-kiosk-plinth', new THREE.BoxGeometry(1.3, 0.14, 0.9), bronze, [0, 0.07, 0]);
    mesh('ticket-kiosk-body', new THREE.BoxGeometry(0.95, 1.12, 0.6), bronze, [0, 0.7, 0]);
    const head = mesh('ticket-kiosk-head', new THREE.BoxGeometry(1.05, 0.62, 0.34), bronze, [0, 1.52, -0.08]);
    head.rotation.x = -0.32;
    mesh('ticket-kiosk-slot', new THREE.BoxGeometry(0.46, 0.05, 0.08), brass, [0, 1.04, 0.31]);
    mesh('ticket-kiosk-trim', new THREE.BoxGeometry(1.0, 0.04, 0.64), brass, [0, 1.27, 0]);

    this.screenIdle = this.screenTexture('Admissions', ['Take a ticket to enter.', 'Admission is free.']);
    this.screenDone = this.screenTexture('Admit one', ['Your ticket is printed.', 'The doors are just ahead.']);
    const screen = new THREE.Mesh(
      s.track(new THREE.PlaneGeometry(0.86, 0.46)),
      s.track(new THREE.MeshBasicMaterial({ map: this.screenIdle, toneMapped: false })),
    );
    screen.name = 'ticket-kiosk-screen';
    screen.position.set(0, 1.55, 0.1);
    screen.rotation.x = -0.32;
    this.group.add(screen);
    this.screen = screen;

    // A lit "Tickets" blade on a post, readable from the approach.
    mesh('ticket-kiosk-post', new THREE.CylinderGeometry(0.05, 0.06, 2.9, 10), bronze, [0.62, 1.45, -0.18]);
    const sign = new THREE.Mesh(
      s.track(new THREE.PlaneGeometry(1.2, 0.34)),
      s.track(new THREE.MeshBasicMaterial({ map: this.signTexture(), toneMapped: false })),
    );
    sign.name = 'ticket-kiosk-sign';
    sign.position.set(0.62, 2.72, -0.12);
    this.group.add(sign);
    mesh('ticket-kiosk-lamp', new THREE.SphereGeometry(0.07, 12, 8), glow, [0.62, 2.98, -0.18]);

    // The printed ticket, hidden until issued; it slides out of the slot.
    const ticket = mesh('ticket-kiosk-ticket', new THREE.BoxGeometry(0.34, 0.008, 0.16), paper, [0, 1.05, 0.3]);
    ticket.visible = false;
    this.ticket = ticket;

    this.collision.addBox([x, GROUND_Y + 0.9, z], [0.6, 0.9, 0.55]);

    const control: ExhibitControl = {
      object: this.group,
      label: () => (isIssued() ? 'Your ticket is printed' : 'Take a ticket'),
      description: 'The admissions kiosk. Take a ticket to enter the museum.',
      activate: () => { if (!isIssued()) onTake(); },
    };
    return { group: this.group, control };
  }

  /** Show the printed ticket and the "Admit one" screen. */
  markIssued(): void {
    if (this.issuedAt >= 0) return;
    this.issuedAt = this.elapsed;
    if (this.ticket) this.ticket.visible = true;
    const material = this.screen?.material as THREE.MeshBasicMaterial | undefined;
    if (material && this.screenDone) { material.map = this.screenDone; material.needsUpdate = true; }
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (!this.ticket || this.issuedAt < 0) return;
    const t = Math.min(1, (this.elapsed - this.issuedAt) / 0.9);
    this.ticket.position.z = 0.3 + 0.12 * (1 - (1 - t) ** 3);
  }

  private screenTexture(title: string, lines: string[]): THREE.Texture {
    if (!canRenderText()) return createFallbackTexture(this.scope, 0x1b1712);
    return createTextTexture(this.scope, lines, {
      width: 640, height: 340, title, titleSize: 84, bodySize: 50, align: 'center', rule: false,
      padding: 34, background: '#16120f', titleColor: '#f0c97a', color: '#d9cfbd',
    });
  }

  private signTexture(): THREE.Texture {
    if (!canRenderText()) return createFallbackTexture(this.scope, 0xe8c65a);
    return createTextTexture(this.scope, [], {
      width: 600, height: 170, title: 'Tickets', titleSize: 92, align: 'center', rule: false,
      padding: 30, background: '#141118', titleColor: '#e8c65a',
    });
  }
}
