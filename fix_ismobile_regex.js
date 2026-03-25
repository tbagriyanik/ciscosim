import fs from 'fs';
const path = 'f:/netsim2026/ciscosim/src/app/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = /const \[activeDeviceId, setActiveDeviceId\] = useState<string>\('switch-1'\);/;
const insertion = `const [activeDeviceId, setActiveDeviceId] = useState<string>('switch-1');
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1024px)");
    const update = () => setIsMobile(mq.matches);
    const mql = (e) => update();
    update();
    mq.addEventListener("change", mql);
    return () => mq.removeEventListener("change", mql);
  }, []);`;

if (target.test(c) && !c.includes('const [isMobile, setIsMobile]')) {
    c = c.replace(target, insertion);
    fs.writeFileSync(path, c);
    console.log("Updated page.tsx with isMobile");
} else {
    console.log("REGEX FAIL or ALREADY UPDATED");
}
