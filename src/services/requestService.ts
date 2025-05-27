/* eslint-disable @typescript-eslint/no-unused-vars */
const getMockUser = (userId: string): DemoUser | undefined => {
  return mockUsers.find(u => u.id === userId);
}

const RATING_GRACE_PERIOD_DAYS = 7;
const STANDARD_WARRANTY_DAYS = 3;
const PREMIUM_WARRANTY_DAYS = 7;
/* eslint-enable @typescript-eslint/no-unused-vars */
