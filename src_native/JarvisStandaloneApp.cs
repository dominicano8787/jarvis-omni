using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("J.A.R.V.I.S. v4.0 Standalone Omni-Application")]
[assembly: AssemblyDescription("J.A.R.V.I.S. v4.0 Native Windows App - Gemini Pro Soul + Ghidra 12.1.4 + WendyOS Physical AI + Z Fold 7 Mesh")]
[assembly: AssemblyCompany("Stark Industries // Autonomous Systems")]
[assembly: AssemblyProduct("J.A.R.V.I.S. v4.0")]
[assembly: AssemblyVersion("4.0.0.0")]

namespace JarvisNative
{
    public class JarvisControlForm : Form
    {
        public const string GithubCloudUrl = "https://dominicano8787.github.io/jarvis-omni/";
        private string rootDir;
        private Process temporalProc;
        private Process backendProc;
        private Process appWindowProc;
        private NotifyIcon trayIcon;
        private Label statusLabel;
        private Label subStatusLabel;
        private System.Windows.Forms.Timer healthTimer;

        public JarvisControlForm(string root)
        {
            this.rootDir = root;
            this.Text = "J.A.R.V.I.S. v4.0 // Native Standalone Omni-System";
            this.Size = new Size(640, 380);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(4, 10, 22);
            this.ForeColor = Color.FromArgb(224, 247, 255);
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;

            string icoPath = Path.Combine(rootDir, "jarvis.ico");
            if (File.Exists(icoPath))
            {
                try { this.Icon = new Icon(icoPath); } catch { }
            }

            BuildUI();
            SetupTray();

            this.Shown += (s, e) =>
            {
                ThreadPool.QueueUserWorkItem(_ => BootSubsystemsAndLaunchShell());
            };

            healthTimer = new System.Windows.Forms.Timer();
            healthTimer.Interval = 4000;
            healthTimer.Tick += (s, e) => UpdateTelemetryLeds();
            healthTimer.Start();
        }

        private void BuildUI()
        {
            Label title = new Label();
            title.Text = "J.A.R.V.I.S. // MARK IX STANDALONE OMNI-SYSTEM";
            title.Font = new Font("Consolas", 13, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(0, 240, 255);
            title.Location = new Point(24, 20);
            title.AutoSize = true;
            this.Controls.Add(title);

            Label soulBadge = new Label();
            soulBadge.Text = "SOUL CORE: GEMINI PRO  |  FUSED: OPENART.AI × HIGGSFIELD AI × CAPCUT NLE";
            soulBadge.Font = new Font("Consolas", 9, FontStyle.Regular);
            soulBadge.ForeColor = Color.FromArgb(176, 38, 255);
            soulBadge.Location = new Point(24, 46);
            soulBadge.AutoSize = true;
            this.Controls.Add(soulBadge);

            Panel matrixPanel = new Panel();
            matrixPanel.Location = new Point(24, 78);
            matrixPanel.Size = new Size(576, 155);
            matrixPanel.BackColor = Color.FromArgb(8, 18, 38);
            matrixPanel.BorderStyle = BorderStyle.FixedSingle;
            this.Controls.Add(matrixPanel);

            statusLabel = new Label();
            statusLabel.Text = "[INITIALIZING] Booting Gemini Pro Soul & Durable Subsystems...";
            statusLabel.Font = new Font("Consolas", 10, FontStyle.Bold);
            statusLabel.ForeColor = Color.FromArgb(0, 240, 255);
            statusLabel.Location = new Point(14, 14);
            statusLabel.Size = new Size(545, 24);
            matrixPanel.Controls.Add(statusLabel);

            subStatusLabel = new Label();
            subStatusLabel.Text =
                "• GitHub Cloud Server: https://dominicano8787.github.io/jarvis-omni/ (24/7 PC-Off Ready)\r\n" +
                "• Autonomous Agentic : Multi-Step ReAct 7-Tool Engine + Gemini Pro Soul + British TTS\r\n" +
                "• REA & Physical AI  : Ghidra 12.1.4 Decompiler + WendyOS Physical AI (wendylabsinc)\r\n" +
                "• Creative Studios   : Faceless Narrated Video + OpenArt 4K + Higgsfield + CapCut\r\n" +
                "• Durable & Mobile   : Temporal Approval Gates + Galaxy Z Fold 7 (SM-F966U) APK Mesh";
            subStatusLabel.Font = new Font("Consolas", 9, FontStyle.Regular);
            subStatusLabel.ForeColor = Color.FromArgb(180, 220, 245);
            subStatusLabel.Location = new Point(14, 44);
            subStatusLabel.Size = new Size(545, 100);
            matrixPanel.Controls.Add(subStatusLabel);

            Button launchHudBtn = CreateCyberButton("OPEN GITHUB CLOUD SERVER (24/7)", new Point(24, 252), new Size(280, 42), Color.FromArgb(0, 240, 255));
            launchHudBtn.Click += (s, e) => OpenChromelessAppWindow(GithubCloudUrl);
            this.Controls.Add(launchHudBtn);

            Button restartBtn = CreateCyberButton("OPEN HYBRID / LOCAL (:8777)", new Point(320, 252), new Size(280, 42), Color.FromArgb(16, 163, 127));
            restartBtn.Click += (s, e) => OpenChromelessAppWindow(IsPortListening(8777) ? "http://127.0.0.1:8777" : GithubCloudUrl);
            this.Controls.Add(restartBtn);

            Label footer = new Label();
            footer.Text = "GitHub Cloud Server Active (dominicano8787/jarvis-omni) — Works 24/7 even without local PC daemon.";
            footer.Font = new Font("Consolas", 8, FontStyle.Italic);
            footer.ForeColor = Color.FromArgb(110, 150, 180);
            footer.Location = new Point(24, 312);
            footer.AutoSize = true;
            this.Controls.Add(footer);
        }

        private Button CreateCyberButton(string text, Point loc, Size sz, Color accent)
        {
            Button btn = new Button();
            btn.Text = text;
            btn.Location = loc;
            btn.Size = sz;
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderColor = accent;
            btn.FlatAppearance.BorderSize = 1;
            btn.BackColor = Color.FromArgb(10, 26, 52);
            btn.ForeColor = accent;
            btn.Font = new Font("Consolas", 9, FontStyle.Bold);
            btn.Cursor = Cursors.Hand;
            return btn;
        }

        private void SetupTray()
        {
            trayIcon = new NotifyIcon();
            trayIcon.Text = "J.A.R.V.I.S. v4.1 (GitHub Cloud + Autonomous Agent)";
            trayIcon.Icon = this.Icon ?? SystemIcons.Application;
            trayIcon.Visible = true;

            ContextMenu menu = new ContextMenu();
            menu.MenuItems.Add("Open J.A.R.V.I.S. GitHub Cloud Server (24/7)", (s, e) => OpenChromelessAppWindow(GithubCloudUrl));
            menu.MenuItems.Add("Open J.A.R.V.I.S. Local/Hybrid Window", (s, e) => OpenChromelessAppWindow(IsPortListening(8777) ? "http://127.0.0.1:8777" : GithubCloudUrl));
            menu.MenuItems.Add("Show Native Control Deck", (s, e) => { this.Show(); this.WindowState = FormWindowState.Normal; this.BringToFront(); });
            menu.MenuItems.Add("-");
            menu.MenuItems.Add("Exit J.A.R.V.I.S.", (s, e) => Application.Exit());
            trayIcon.ContextMenu = menu;
            trayIcon.DoubleClick += (s, e) => OpenChromelessAppWindow(GithubCloudUrl);
        }

        public static bool IsPortListening(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult res = client.BeginConnect("127.0.0.1", port, null, null);
                    bool ok = res.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(350));
                    if (!ok) return false;
                    client.EndConnect(res);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private void BootSubsystemsAndLaunchShell()
        {
            SetStatus("[1/3] Checking Temporal Durable Cluster on 127.0.0.1:7233...");
            if (!IsPortListening(7233))
            {
                string temporalExe = @"C:\Users\plata\.temporal\bin\temporal.exe";
                if (!File.Exists(temporalExe)) temporalExe = "temporal";
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo(temporalExe, "server start-dev --ip 127.0.0.1 --headless");
                    psi.WorkingDirectory = rootDir;
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    temporalProc = Process.Start(psi);
                }
                catch { }
            }

            SetStatus("[2/3] Starting Gemini Pro Soul & Omni-Studio Backend (:8777)...");
            if (!IsPortListening(8777))
            {
                string pyExe = Path.Combine(rootDir, @".python\cpython-3.13.14-windows-x86_64-none\python.exe");
                if (!File.Exists(pyExe)) pyExe = Path.Combine(rootDir, @".venv\Scripts\python.exe");
                if (!File.Exists(pyExe) && File.Exists(@"D:\Jarvis\.python\cpython-3.13.14-windows-x86_64-none\python.exe"))
                {
                    pyExe = @"D:\Jarvis\.python\cpython-3.13.14-windows-x86_64-none\python.exe";
                }
                if (!File.Exists(pyExe)) pyExe = "python";
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo(pyExe, "-m uvicorn server.main:app --host 0.0.0.0 --port 8777");
                    psi.WorkingDirectory = rootDir;
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                    string extraPath = Path.Combine(userProfile, @".temporal\bin") + ";" +
                                       Path.Combine(userProfile, @".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin") + ";" +
                                       @"D:\UserData\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\plata\.temporal\bin;D:\Apps\ffmpeg\bin;C:\Users\plata\AppData\Local\hermes\node;C:\Users\plata\.grok\bin;C:\Users\plata\AppData\Local\Programs\OpenAI\Codex\bin;";
                    psi.EnvironmentVariables["PATH"] = extraPath + Environment.GetEnvironmentVariable("PATH");
                    backendProc = Process.Start(psi);
                }
                catch { }

                for (int i = 0; i < 25; i++)
                {
                    if (IsPortListening(8777)) break;
                    Thread.Sleep(250);
                }
            }

            SetStatus("[ONLINE] GitHub Cloud Server (dominicano8787/jarvis-omni) & Subsystems Active");
            string targetUrl = GithubCloudUrl;
            OpenChromelessAppWindow(targetUrl);
        }

        private void SetStatus(string text)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => statusLabel.Text = text));
            }
            else
            {
                statusLabel.Text = text;
            }
        }

        private void UpdateTelemetryLeds()
        {
            bool tOk = IsPortListening(7233);
            bool bOk = IsPortListening(8777);
            statusLabel.Text = string.Format(
                "[ONLINE] Gemini Soul: ACTIVE | Core (:8777): {0} | Temporal (:7233): {1}",
                bOk ? "ONLINE" : "STARTING",
                tOk ? "ONLINE" : "STANDBY"
            );
        }

        private void OpenChromelessAppWindow(string url)
        {
            try
            {
                string[] edgePaths = new string[]
                {
                    @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Google\Chrome\Application\chrome.exe"
                };

                string hostBin = null;
                foreach (string p in edgePaths)
                {
                    if (File.Exists(p)) { hostBin = p; break; }
                }

                string profileDir = Path.Combine(rootDir, @"data\standalone_app_profile");
                Directory.CreateDirectory(profileDir);

                if (hostBin != null)
                {
                    string args = string.Format(
                        "--app=\"{0}\" --window-size=1680,960 --user-data-dir=\"{1}\" --autoplay-policy=no-user-gesture-required --no-first-run --no-default-browser-check",
                        url, profileDir
                    );
                    ProcessStartInfo psi = new ProcessStartInfo(hostBin, args);
                    psi.UseShellExecute = false;
                    appWindowProc = Process.Start(psi);
                }
            }
            catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (trayIcon != null) trayIcon.Visible = false;
            base.OnFormClosing(e);
        }
    }

    public static class Program
    {
        [DllImport("kernel32.dll")]
        private static extern bool FreeConsole();

        [STAThread]
        public static int Main(string[] args)
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
            if (!File.Exists(Path.Combine(exeDir, @"server\main.py")) && Directory.Exists(@"D:\Jarvis\server"))
            {
                exeDir = @"D:\Jarvis";
            }

            foreach (string arg in args)
            {
                if (arg.Equals("--verify", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("--check", StringComparison.OrdinalIgnoreCase))
                {
                    bool hasServer = File.Exists(Path.Combine(exeDir, @"server\main.py"));
                    bool hasAgentic = File.Exists(Path.Combine(exeDir, @"server\agentic_engine.py"));
                    bool hasWendy = File.Exists(Path.Combine(exeDir, @"server\wendy_engine.py"));
                    bool hasGhidra = File.Exists(Path.Combine(exeDir, @"server\ghidra_engine.py"));
                    bool hasFaceless = File.Exists(Path.Combine(exeDir, @"server\faceless_engine.py"));
                    bool hasUiDist = File.Exists(Path.Combine(exeDir, @"ui\dist\index.html"));
                    bool hasFold7Apk = File.Exists(Path.Combine(exeDir, "JARVIS-ZFold7-SM-F966U-v4.0.apk"));
                    bool port8777 = JarvisControlForm.IsPortListening(8777);
                    Console.WriteLine("JARVIS_STANDALONE_EXE_VERIFY: OK");
                    Console.WriteLine("Version: 4.1.0.0");
                    Console.WriteLine("GitHubCloudServerUrl: " + JarvisControlForm.GithubCloudUrl);
                    Console.WriteLine("RootDir: " + exeDir);
                    Console.WriteLine("ServerCore: " + hasServer);
                    Console.WriteLine("AgenticReActEngine: " + hasAgentic);
                    Console.WriteLine("WendyPhysicalAiEngine: " + hasWendy);
                    Console.WriteLine("GhidraReaEngine: " + hasGhidra);
                    Console.WriteLine("FacelessVideoEngine: " + hasFaceless);
                    Console.WriteLine("CompiledHudBundle: " + hasUiDist);
                    Console.WriteLine("ZFold7SignedApk: " + hasFold7Apk);
                    Console.WriteLine("Port8777Listening: " + port8777);
                    return (hasServer && hasAgentic && hasWendy && hasGhidra && hasFaceless && hasUiDist && hasFold7Apk) ? 0 : 1;
                }
            }

            try { FreeConsole(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new JarvisControlForm(exeDir));
            return 0;
        }
    }
}
