// autopilot/ego/stories.mjs — capture a creator's Instagram story frames for job extraction.
//
// Instagram stories are images, so this only captures: one screenshot per frame plus any
// links and timestamps the frame exposes. The agent then reads the frames (modes/autopilot.md)
// and resolves each job it sees to an official posting. Uses the user's own signed-in
// Instagram session in Ego Lite; it never logs in by itself.
//
//   ego-browser nodejs <<'EOF'
//   const { captureStories } = await import(`${process.cwd()}/autopilot/ego/stories.mjs`);
//   const task = await taskSpace("autojobs stories");
//   console.log(JSON.stringify(await captureStories(task.page("p1"), { handle: "somecreator", outDir: `${process.cwd()}/data/stories/somecreator/2026-01-01` })));
//   await task.finish({ keep: [] });
//   EOF
import { mkdirSync } from 'node:fs';

export async function captureStories(page, { handle, outDir, maxFrames = 40, after = '' }) {
  mkdirSync(outDir, { recursive: true });
  await page.goto(`https://www.instagram.com/stories/${handle}/`);
  await page.waitForTimeout(4000);
  if (/accounts\/login/.test(await page.url())) return { blocked: 'Instagram is signed out in Ego Lite. Sign in by hand, then rerun.' };
  try { await page.click('text=View story', { label: 'view story' }); } catch {}
  await page.waitForTimeout(2500);
  const frames = [];
  for (let i = 1; i <= maxFrames; i++) {
    const url = await page.url();
    if (!url.includes(`/stories/${handle}/`)) break;
    try { await page.click("loc=role:button[name='Pause']", { label: 'pause story' }); } catch {}
    const data = await page.evaluate((h) => ({
      time: [...document.querySelectorAll('time')].map((t) => t.getAttribute('datetime')).filter(Boolean)[0] || '',
      links: [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((x) => !x.includes('instagram.com') || x.includes('l.instagram.com')).filter((x) => !x.includes(`/${h}`)),
    }), handle);
    // `after` skips frames already processed on an earlier run (ISO timestamp of the last frame seen).
    if (!after || !data.time || data.time > after) {
      const file = `${outDir}/frame-${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: file });
      frames.push({ file, url, ...data });
    }
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1200);
  }
  return { handle, count: frames.length, frames };
}
