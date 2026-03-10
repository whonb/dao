import { syncDependencies } from "../common/sync.js";
import { logger } from "../common/logger.js";

const log = logger.withTag("SyncCLI");

syncDependencies().catch(err => {
    log.error(`同步失败: ${err.message}`);
    process.exit(1);
});
