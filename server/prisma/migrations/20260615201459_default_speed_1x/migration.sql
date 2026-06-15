-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "themePref" TEXT NOT NULL DEFAULT 'system',
    "defaultSpeed" REAL NOT NULL DEFAULT 1.0,
    "autoplay" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" BOOLEAN NOT NULL DEFAULT true,
    "breakingAlerts" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("autoplay", "breakingAlerts", "createdAt", "defaultSpeed", "email", "emailDigest", "id", "onboardedAt", "themePref") SELECT "autoplay", "breakingAlerts", "createdAt", "defaultSpeed", "email", "emailDigest", "id", "onboardedAt", "themePref" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Move existing accounts off the old 1.25x default to the new 1.0x default.
UPDATE "User" SET "defaultSpeed" = 1.0 WHERE "defaultSpeed" = 1.25;
