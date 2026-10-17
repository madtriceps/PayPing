import "dotenv/config";

void import("./reminder.worker").then(({ startReminderWorker }) => {
  startReminderWorker();
});
