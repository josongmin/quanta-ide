import { featureRegistry } from "../../feature-registry";
import { preferences } from "../preferences-store";

/**
 * One-way apply of persisted feature-enable overrides onto the live
 * `featureRegistry`. Runs once at install, and again whenever preferences
 * change (user toggle, external file hydrate).
 *
 * Only touches features that are currently registered and whose state
 * actually differs — leaves "error" state alone (runtime concern, not a
 * preference).
 *
 * Call AFTER all `registerFeatureManifests(...)` calls in the boot
 * sequence — otherwise the registry is empty and the apply is a no-op.
 */
export function bindFeatureRegistryToPreferences(): () => void {
  const apply = () => {
    const overrides = preferences.get().features.enabled;
    const features = featureRegistry.get().features;
    for (const [id, enabled] of Object.entries(overrides)) {
      const record = features.get(id);
      if (!record) continue;
      if (record.state === "error") continue;
      const desired = enabled ? "active" : "disabled";
      if (record.state !== desired) {
        featureRegistry.setState(id, desired);
      }
    }
  };

  apply();
  return preferences.subscribe(apply);
}
