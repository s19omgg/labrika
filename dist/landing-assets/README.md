# Landing assets

- `labrica-mascot.glb`: animated rig prepared locally in Blender from the user-supplied `Meshy_AI_Cool_Mint_Critter_0928033829_texture.glb`. The supplied head, costume and textures are retained; fused glasses are separated, missing inner arm surfaces and eyes are reconstructed, and the torso contact seams repaired. New geometry is limited to rig preparation, not a generated replacement character. The baked performance enters from the right, adjusts glasses, winks and points upward.
- `mascot-3d-poster.webp`: transparent Blender still of that same prepared model; reduced-motion and loading-error fallback.
- `mascot-entrance.webp`, `mascot-poster.webp`: previous MOV-derived assets, retained for rollback only. Not loaded by the hero.
- `mascot-reference.jpg`, `mascot-cutout.png`: original user-provided character reference and cutout used by the small footer peek, not by the hero.

Rebuild the 3D hero with `scripts/prepare-mascot-rig.py` in Blender; the editable master is `assets/mascot/labrica-mascot.blend`. The walkthrough uses HTML/SVG illustrations in `landing/PlatformMockup.tsx`, not platform screenshots or account data.
