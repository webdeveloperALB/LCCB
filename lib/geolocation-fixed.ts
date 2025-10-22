export interface LocationData {
  ip: string;
  country: string;
  country_code: string;
  city: string;
  region: string;
  timezone?: string;
}

export async function getClientIPAddress(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    console.log("Client IP detected:", data.ip);
    return data.ip || "";
  } catch (error) {
    console.error("Error getting client IP:", error);
    return "";
  }
}

export async function getLocationData(
  ip: string
): Promise<Partial<LocationData>> {
  if (!ip) {
    console.warn("No IP provided for location lookup");
    return {};
  }

  try {
    console.log("Getting location for IP:", ip);
    const response = await fetch(`https://ipapi.co/${ip}/json/`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Location data received:", data);

    if (data.error) {
      console.warn("Geolocation API error:", data.reason);
      return { ip };
    }

    const locationData: LocationData = {
      ip: data.ip || ip,
      country: data.country_name || "Unknown",
      country_code: data.country_code || "",
      city: data.city || "Unknown",
      region: data.region || "",
      timezone: data.timezone || "",
    };

    console.log("Processed location data:", locationData);
    return locationData;
  } catch (error) {
    console.error("Error getting location from IP:", error);
    return { ip };
  }
}

export function extractIPFromRequest(request: Request): string {
  const headers = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "x-client-ip",
    "x-forwarded",
    "forwarded-for",
    "forwarded",
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      const ip = value.split(",")[0].trim();
      if (ip && ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1") {
        console.log(`IP found in ${header}:`, ip);
        return ip;
      }
    }
  }

  console.log("No valid IP found in headers");
  return "";
}

// Aliases for compatibility
export const getIPFromRequest = extractIPFromRequest;
export const getLocationFromIP = getLocationData;
