
import { NextResponse } from "next/server";
import { discoverItems } from "../../../../lib/discover";

export const dynamic = "force-dynamic";

export async function GET(){
  const data = await discoverItems();
  return NextResponse.json({
    ...data,
    updatedAt: new Date().toISOString()
  }, {headers:{"Cache-Control":"no-store"}});
}
