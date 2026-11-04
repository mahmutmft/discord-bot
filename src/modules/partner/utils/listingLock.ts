const listingQueues = new Map<string, Promise<unknown>>();

export const withPartnerListingLock = async <Result>(
  listingId: string,
  task: () => Promise<Result>,
): Promise<Result> => {
  const previous = listingQueues.get(listingId) ?? Promise.resolve();
  const { promise: current, resolve: release } =
    Promise.withResolvers<undefined>();
  listingQueues.set(listingId, current);

  await previous;
  try {
    return await task();
  } finally {
    release(undefined);
    if (listingQueues.get(listingId) === current) {
      listingQueues.delete(listingId);
    }
  }
};
