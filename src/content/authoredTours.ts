import { ENTRANCE_DOOR, PLACEMENT_BY_EXHIBIT } from '../world/layout';
import { exhibitWalkDistance } from '../world/visitorRoute';

interface TourStop {
  readonly exhibitId: string;
  readonly instruction: string;
  readonly bridgeFromPrevious?: string;
}

interface AuthoredTour {
  readonly id: string;
  readonly title: string;
  readonly opening: string;
  readonly stops: readonly TourStop[];
}

export const AUTHORED_TOURS: readonly AuthoredTour[] = [
  {
    id: 'what-stays-on-the-machine',
    title: 'What stays on the machine?',
    opening: 'Start with a single sentence, then see who gets to decide what happens to a file or a remote machine.',
    stops: [
      { exhibitId: 'E17', instruction: 'Find the meeting sample. Compare “for” in the first transcript with “four” in the corrected version.' },
      {
        exhibitId: 'E20', instruction: 'Sort the files. Compare the photo bin with the caches an app can rebuild.',
        bridgeFromPrevious: 'The Voice Lab shows what a tool can correct. At the bench, decide what it should leave for you.',
      },
      {
        exhibitId: 'E34', instruction: 'Select the service restart. Try running it before previewing, then preview it and compare the receipts.',
        bridgeFromPrevious: 'The bench leaves the decision with you. The control room makes that decision visible at the gate.',
      },
    ],
  },
  {
    id: 'what-does-loss-leave-behind',
    title: 'What does loss leave behind?',
    opening: 'A station, a living world, and a night sky each show the consequences of taking something away.',
    stops: [
      { exhibitId: 'E03', instruction: 'Advance the dismantling clock until open sky shows through the station frame.' },
      {
        exhibitId: 'E07', instruction: 'Try a station, then introduce Syrin contact. Watch the world as the active Starsilk color drains away.',
        bridgeFromPrevious: 'The station loses its pieces over months. In the lab, one change can take effect across the model world at once.',
      },
      {
        exhibitId: 'E08', instruction: 'Start the reconstruction. Keep watching the star field through the last two records.',
        bridgeFromPrevious: 'The lab lets you make the change. The observatory puts you in the position of someone looking up afterward.',
      },
    ],
  },
  {
    id: 'what-changes-when-you-play',
    title: 'What changes when you play?',
    opening: 'Three ways a game can make an action felt, through size, through what it leaves on the floor, and through rhythm.',
    stops: [
      { exhibitId: 'E32', instruction: 'Start the ball rolling. Watch for the first larger object that sticks as the ball grows.' },
      {
        exhibitId: 'E30', instruction: 'Advance the cast through all five stages, then remove the mark it leaves on the floor.',
        bridgeFromPrevious: 'Rolling changes what the ball can pick up. Here an action changes the place where it lands.',
      },
      {
        exhibitId: 'E27', instruction: 'Open the playable build and try the rhythm controls. Escape returns you to the museum.',
        bridgeFromPrevious: 'The spell separates warning, impact, and aftermath. The rhythm game makes the timing of each input the thing you play.',
      },
    ],
  },
];

export function authoredTour(id: unknown): AuthoredTour | undefined {
  return AUTHORED_TOURS.find((tour) => tour.id === id);
}

/** Allow a little time at turns and stairs. Time spent at stops is separate. */
export function estimatedWalkingMinutes(stops: readonly string[]): number {
  let from = ENTRANCE_DOOR;
  let metres = 0;
  for (const id of stops) {
    const placement = PLACEMENT_BY_EXHIBIT.get(id);
    if (!placement) continue;
    metres += exhibitWalkDistance(from, id);
    from = placement.visitorSpot;
  }
  return Math.max(1, Math.ceil(metres / 150));
}
