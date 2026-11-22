# ISLAND-04 browser evidence

Chrome 157 on MacBookAir10,1, with ANGLE Metal requested. Local Vite production preview, 960 × 540, low quality after cold start. The test set explicit camera positions and hid museum UI for the screenshots. The rooftop stand also passed the keyboard walkthrough in Chrome/SwiftShader, including the existing west-flank ascent and rooftop interactions.

- [The staffed stand](hot-dog-stand.png), [idle](hot-dog-man-idle.png) and [serve](hot-dog-man-serving.png).
- [Coffee at the café](island-coffee.png), [Robothead at the wind grove](island-robothead.png), [Carrot Kid at the meadow](island-carrot-kid.png), [Cactusboy at Fern Ravine](island-cactusboy.png), [Froggy near the tidepools](island-froggy.png), [Eyewizard at the stone circle](island-eyewizard.png) and [Goldfish Bag Person by the reflecting rill](island-goldfish-bag-person.png).
- Browser request trace had zero NPC requests through the first rendered exterior frames and the interior had yet to be constructed. Navigation and resource timings reported 645,552 transferred bytes. All eight GLBs were requested from the local application origin on approach. The seven ambient residents released their leases when the camera left their areas.
- The production test verified the chef's counter-facing orientation and idle motion, activated the stand through the runtime raycast/interaction manager, measured the right hand moving forward, and checked that reduced-motion mode held a still pose.
- The unchanged package checker counted 16.28 MiB of its 20 MiB allowance. It counts all eight NPC files regardless of when the browser fetches them. Separate existing embedded-artifact accounting remains in that checker.
- [Capture hashes](SHA256SUMS.txt). Human acceptance and representative-device frame-time results require separate evidence.
