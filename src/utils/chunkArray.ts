const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunked_arr: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked_arr.push(array.slice(i, i + size));
  }
  return chunked_arr;
};

export default chunkArray;
