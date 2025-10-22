export interface LocationInfo {
  ip: string;
  country?: string;
  country_code?: string;
  city?: string;
  region?: string;
}

export async function getUserIP(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data: { ip?: string } = await response.json();
    return data.ip ?? "";
  } catch (error) {
    console.error("Failed to get IP:", error);
    return "";
  }
}

export async function getLocationFromIP(ip: string): Promise<LocationInfo> {
  if (!ip) {
    console.warn("No IP provided for location lookup");
    return { ip: "" };
  }

  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!response.ok) {
      throw new Error(`Location API error: ${response.statusText}`);
    }

    const data: any = await response.json();

    return {
      ip: data.ip || ip,
      country: data.country_name || "Unknown",
      country_code: data.country_code || "",
      city: data.city || "Unknown",
      region: data.region || "",
    };
  } catch (error) {
    console.error("Failed to get location from IP:", error);
    return { ip };
  }
}
