export type MapLocation = { doctorId: string; label: string; city: string; authorized: boolean; latitude: number; longitude: number };

export function clusterMapLocations(locations: MapLocation[]) {
  const clusters: Array<{ doctorIds: string[]; latitude: number; longitude: number }> = [];
  for (const location of locations.filter((item) => item.authorized)) {
    const existing = clusters.find((cluster) => Math.abs(cluster.latitude - location.latitude) < 0.002 && Math.abs(cluster.longitude - location.longitude) < 0.002);
    if (existing) existing.doctorIds.push(location.doctorId);
    else clusters.push({ doctorIds: [location.doctorId], latitude: location.latitude, longitude: location.longitude });
  }
  return clusters;
}
