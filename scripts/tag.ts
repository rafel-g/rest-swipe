/** Tag every untagged restaurant: npm run tag */
import { tagUntagged } from "../lib/tagging";

tagUntagged((n) => console.log(`tagged ${n}`))
  .then((n) => console.log(`Done: ${n} restaurants tagged.`))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
