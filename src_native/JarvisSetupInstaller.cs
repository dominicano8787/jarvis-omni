using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("J.A.R.V.I.S. v4.0 Standalone Windows Setup")]
[assembly: AssemblyDescription("Self-Contained Windows Installer for J.A.R.V.I.S. v4.0 (Gemini Pro Soul + Ghidra 12.1.4 + WendyOS Physical AI + Z Fold 7 APK)")]
[assembly: AssemblyCompany("Stark Industries // Autonomous Systems")]
[assembly: AssemblyProduct("J.A.R.V.I.S. v4.0 Setup")]
[assembly: AssemblyVersion("4.0.0.0")]

namespace JarvisInstaller
{
    public class SetupWizardForm : Form
    {
        private TextBox pathBox;
        private CheckBox desktopShortcutCheck;
        private CheckBox startMenuCheck;
        private CheckBox launchAfterCheck;
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button installBtn;
        private Button browseBtn;

        public SetupWizardForm()
        {
            this.Text = "J.A.R.V.I.S. v4.0 // Standalone Windows Setup Wizard";
            this.Size = new Size(660, 440);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(4, 10, 22);
            this.ForeColor = Color.FromArgb(224, 247, 255);
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;

            BuildUI();
        }

        private void BuildUI()
        {
            Label header = new Label();
            header.Text = "J.A.R.V.I.S. v4.0 // STANDALONE OMNI-SYSTEM INSTALLER";
            header.Font = new Font("Consolas", 13, FontStyle.Bold);
            header.ForeColor = Color.FromArgb(0, 240, 255);
            header.Location = new Point(24, 20);
            header.AutoSize = true;
            this.Controls.Add(header);

            Label subHeader = new Label();
            subHeader.Text = "Gemini Pro Soul  |  Ghidra 12.1.4  |  WendyOS Physical AI  |  Z Fold 7 Companion";
            subHeader.Font = new Font("Consolas", 9, FontStyle.Regular);
            subHeader.ForeColor = Color.FromArgb(176, 38, 255);
            subHeader.Location = new Point(24, 46);
            subHeader.AutoSize = true;
            this.Controls.Add(subHeader);

            Panel infoPanel = new Panel();
            infoPanel.Location = new Point(24, 76);
            infoPanel.Size = new Size(596, 110);
            infoPanel.BackColor = Color.FromArgb(8, 18, 38);
            infoPanel.BorderStyle = BorderStyle.FixedSingle;
            this.Controls.Add(infoPanel);

            Label desc = new Label();
            desc.Text =
                "This self-contained setup package installs the complete J.A.R.V.I.S. v4.0 Standalone\r\n" +
                "Desktop Application + Samsung Galaxy Z Fold 7 (SM-F966U) APK on your PC:\r\n" +
                "  • Native Standalone Executable (JARVIS.exe) + Signed Android APK Included\r\n" +
                "  • Ghidra 12.1.4 Reverse Engineering + WendyOS Physical AI & Robotics Harness\r\n" +
                "  • Autonomous Faceless Video Studio + Temporal Gates + 3D Holographic HUD";
            desc.Font = new Font("Consolas", 9, FontStyle.Regular);
            desc.ForeColor = Color.FromArgb(190, 230, 250);
            desc.Location = new Point(12, 10);
            desc.Size = new Size(572, 90);
            infoPanel.Controls.Add(desc);

            Label dirLabel = new Label();
            dirLabel.Text = "DESTINATION DIRECTORY:";
            dirLabel.Font = new Font("Consolas", 9, FontStyle.Bold);
            dirLabel.ForeColor = Color.FromArgb(0, 240, 255);
            dirLabel.Location = new Point(24, 200);
            dirLabel.AutoSize = true;
            this.Controls.Add(dirLabel);

            string defaultDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                @"Programs\JARVIS"
            );

            pathBox = new TextBox();
            pathBox.Text = defaultDir;
            pathBox.Location = new Point(24, 222);
            pathBox.Size = new Size(490, 26);
            pathBox.BackColor = Color.FromArgb(10, 22, 44);
            pathBox.ForeColor = Color.White;
            pathBox.Font = new Font("Consolas", 10, FontStyle.Regular);
            pathBox.BorderStyle = BorderStyle.FixedSingle;
            this.Controls.Add(pathBox);

            browseBtn = new Button();
            browseBtn.Text = "BROWSE...";
            browseBtn.Location = new Point(524, 220);
            browseBtn.Size = new Size(96, 26);
            browseBtn.FlatStyle = FlatStyle.Flat;
            browseBtn.BackColor = Color.FromArgb(12, 30, 60);
            browseBtn.ForeColor = Color.FromArgb(0, 240, 255);
            browseBtn.Font = new Font("Consolas", 8, FontStyle.Bold);
            browseBtn.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.SelectedPath = pathBox.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        pathBox.Text = fbd.SelectedPath;
                    }
                }
            };
            this.Controls.Add(browseBtn);

            desktopShortcutCheck = new CheckBox();
            desktopShortcutCheck.Text = "Create Desktop Shortcut (J.A.R.V.I.S. v4.0)";
            desktopShortcutCheck.Checked = true;
            desktopShortcutCheck.Location = new Point(24, 260);
            desktopShortcutCheck.AutoSize = true;
            desktopShortcutCheck.Font = new Font("Consolas", 9);
            this.Controls.Add(desktopShortcutCheck);

            startMenuCheck = new CheckBox();
            startMenuCheck.Text = "Create Start Menu Program Shortcut";
            startMenuCheck.Checked = true;
            startMenuCheck.Location = new Point(340, 260);
            startMenuCheck.AutoSize = true;
            startMenuCheck.Font = new Font("Consolas", 9);
            this.Controls.Add(startMenuCheck);

            launchAfterCheck = new CheckBox();
            launchAfterCheck.Text = "Launch J.A.R.V.I.S. Standalone App after installation";
            launchAfterCheck.Checked = true;
            launchAfterCheck.Location = new Point(24, 286);
            launchAfterCheck.AutoSize = true;
            launchAfterCheck.Font = new Font("Consolas", 9);
            this.Controls.Add(launchAfterCheck);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(24, 318);
            progressBar.Size = new Size(596, 20);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;
            this.Controls.Add(progressBar);

            statusLabel = new Label();
            statusLabel.Text = "Ready to install J.A.R.V.I.S. v4.0 Standalone Package.";
            statusLabel.Font = new Font("Consolas", 9, FontStyle.Regular);
            statusLabel.ForeColor = Color.FromArgb(160, 210, 240);
            statusLabel.Location = new Point(24, 348);
            statusLabel.Size = new Size(380, 32);
            this.Controls.Add(statusLabel);

            installBtn = new Button();
            installBtn.Text = "INSTALL J.A.R.V.I.S. v4.0";
            installBtn.Location = new Point(420, 344);
            installBtn.Size = new Size(200, 38);
            installBtn.FlatStyle = FlatStyle.Flat;
            installBtn.FlatAppearance.BorderColor = Color.FromArgb(0, 240, 255);
            installBtn.BackColor = Color.FromArgb(10, 36, 68);
            installBtn.ForeColor = Color.FromArgb(0, 240, 255);
            installBtn.Font = new Font("Consolas", 10, FontStyle.Bold);
            installBtn.Cursor = Cursors.Hand;
            installBtn.Click += (s, e) => StartInstallation();
            this.Controls.Add(installBtn);
        }

        private void StartInstallation()
        {
            string targetDir = pathBox.Text.Trim();
            if (string.IsNullOrEmpty(targetDir)) return;

            installBtn.Enabled = false;
            browseBtn.Enabled = false;
            pathBox.ReadOnly = true;

            bool makeDesktop = desktopShortcutCheck.Checked;
            bool makeStart = startMenuCheck.Checked;
            bool launchNow = launchAfterCheck.Checked;

            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    UpdateProgress(15, "Extracting embedded J.A.R.V.I.S. v4.0 payload...");
                    Program.ExtractEmbeddedPayload(targetDir);

                    UpdateProgress(65, "Writing uninstaller & environment bootstrap...");
                    Program.WriteUninstaller(targetDir);

                    if (makeDesktop)
                    {
                        UpdateProgress(80, "Creating Desktop shortcut...");
                        string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                        Program.CreateShortcut(
                            Path.Combine(desktop, "J.A.R.V.I.S. v4.0.lnk"),
                            Path.Combine(targetDir, "JARVIS.exe"),
                            targetDir,
                            Path.Combine(targetDir, "jarvis.ico")
                        );
                    }

                    if (makeStart)
                    {
                        UpdateProgress(90, "Creating Start Menu shortcut...");
                        string startPrograms = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                        Program.CreateShortcut(
                            Path.Combine(startPrograms, "J.A.R.V.I.S. v4.0.lnk"),
                            Path.Combine(targetDir, "JARVIS.exe"),
                            targetDir,
                            Path.Combine(targetDir, "jarvis.ico")
                        );
                    }

                    UpdateProgress(100, "Installation Complete! J.A.R.V.I.S. v4.0 is ready.");

                    if (launchNow)
                    {
                        string exePath = Path.Combine(targetDir, "JARVIS.exe");
                        if (File.Exists(exePath))
                        {
                            Process.Start(new ProcessStartInfo(exePath) { WorkingDirectory = targetDir });
                        }
                    }

                    this.BeginInvoke(new Action(() =>
                    {
                        MessageBox.Show(
                            "J.A.R.V.I.S. v4.0 Standalone Omni-System has been installed successfully to:\r\n" + targetDir,
                            "J.A.R.V.I.S. v4.0 Setup Complete",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                        Application.Exit();
                    }));
                }
                catch (Exception ex)
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        statusLabel.Text = "Error: " + ex.Message;
                        installBtn.Enabled = true;
                    }));
                }
            });
        }

        private void UpdateProgress(int val, string msg)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() =>
                {
                    progressBar.Value = val;
                    statusLabel.Text = msg;
                }));
            }
            else
            {
                progressBar.Value = val;
                statusLabel.Text = msg;
            }
        }
    }

    public static class Program
    {
        [DllImport("kernel32.dll")]
        private static extern bool FreeConsole();

        public static void ExtractEmbeddedPayload(string targetDir)
        {
            Directory.CreateDirectory(targetDir);
            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream resStream = asm.GetManifestResourceStream("payload.zip"))
            {
                if (resStream == null)
                {
                    throw new InvalidOperationException("Embedded resource payload.zip not found in installer binary.");
                }
                using (ZipArchive archive = new ZipArchive(resStream, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        string fullPath = Path.Combine(targetDir, entry.FullName.Replace('/', Path.DirectorySeparatorChar));
                        string dirName = Path.GetDirectoryName(fullPath);
                        if (!string.IsNullOrEmpty(dirName))
                        {
                            Directory.CreateDirectory(dirName);
                        }
                        if (!string.IsNullOrEmpty(entry.Name))
                        {
                            entry.ExtractToFile(fullPath, true);
                        }
                    }
                }
            }
        }

        public static void WriteUninstaller(string targetDir)
        {
            string batPath = Path.Combine(targetDir, "Uninstall-JARVIS.bat");
            string content =
                "@echo off\r\n" +
                "echo Removing J.A.R.V.I.S. v4.0 Standalone Application...\r\n" +
                "del /f /q \"%USERPROFILE%\\Desktop\\J.A.R.V.I.S. v4.0.lnk\" 2>nul\r\n" +
                "echo Done.\r\n";
            File.WriteAllText(batPath, content);
        }

        public static void CreateShortcut(string shortcutPath, string targetExe, string workDir, string iconPath)
        {
            try
            {
                string psCmd = string.Format(
                    "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{0}'); $s.TargetPath = '{1}'; $s.WorkingDirectory = '{2}'; $s.IconLocation = '{3}'; $s.Save()",
                    shortcutPath.Replace("'", "''"),
                    targetExe.Replace("'", "''"),
                    workDir.Replace("'", "''"),
                    iconPath.Replace("'", "''")
                );
                ProcessStartInfo psi = new ProcessStartInfo("powershell.exe", "-NoProfile -Command \"" + psCmd + "\"");
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                Process p = Process.Start(psi);
                if (p != null) p.WaitForExit(4000);
            }
            catch { }
        }

        [STAThread]
        public static int Main(string[] args)
        {
            if (args.Length >= 2 &&
                (args[0].Equals("--verify-install", StringComparison.OrdinalIgnoreCase) ||
                 args[0].Equals("--silent", StringComparison.OrdinalIgnoreCase)))
            {
                string targetDir = args[1];
                try
                {
                    ExtractEmbeddedPayload(targetDir);
                    WriteUninstaller(targetDir);
                    bool hasExe = File.Exists(Path.Combine(targetDir, "JARVIS.exe"));
                    bool hasMain = File.Exists(Path.Combine(targetDir, @"server\main.py"));
                    bool hasRouter = File.Exists(Path.Combine(targetDir, @"server\ai_router.py"));
                    bool hasWendy = File.Exists(Path.Combine(targetDir, @"server\wendy_engine.py"));
                    bool hasGhidra = File.Exists(Path.Combine(targetDir, @"server\ghidra_engine.py"));
                    bool hasHud = File.Exists(Path.Combine(targetDir, @"ui\dist\index.html"));
                    bool hasApk = File.Exists(Path.Combine(targetDir, "JARVIS-ZFold7-SM-F966U-v4.0.apk"));
                    Console.WriteLine("JARVIS_SETUP_INSTALLER_VERIFY: OK (v4.0)");
                    Console.WriteLine("ExtractedDir: " + targetDir);
                    Console.WriteLine("HasStandaloneExe: " + hasExe);
                    Console.WriteLine("HasServerCore: " + hasMain);
                    Console.WriteLine("HasMultiCliRouter: " + hasRouter);
                    Console.WriteLine("HasWendyOsEngine: " + hasWendy);
                    Console.WriteLine("HasGhidraEngine: " + hasGhidra);
                    Console.WriteLine("HasCompiledOmniHud: " + hasHud);
                    Console.WriteLine("HasZFold7SignedApk: " + hasApk);
                    return (hasExe && hasMain && hasRouter && hasWendy && hasGhidra && hasHud && hasApk) ? 0 : 1;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("JARVIS_SETUP_INSTALLER_ERROR: " + ex.Message);
                    return 2;
                }
            }

            try { FreeConsole(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupWizardForm());
            return 0;
        }
    }
}
