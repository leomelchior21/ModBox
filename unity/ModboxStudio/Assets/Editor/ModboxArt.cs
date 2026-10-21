using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

// No third-party exporter or asset dependency. Unity authors the meshes; MODBOX streams GLB.
public static class ModboxArt
{
    static readonly CultureInfo CI = CultureInfo.InvariantCulture;
    static Transform root;
    static Material Paint(string hex, float metal = 0) {
        var m = new Material(Shader.Find("Standard")); ColorUtility.TryParseHtmlString(hex, out var c); m.color = c; m.SetFloat("_Metallic", metal); m.SetFloat("_Glossiness", .45f); return m;
    }
    static GameObject Part(string name, PrimitiveType shape, Material m, float x, float y, float z, float sx, float sy, float sz) {
        var o = GameObject.CreatePrimitive(shape); o.name = name; o.transform.SetParent(root, false); o.transform.localPosition = new Vector3(x,y,z); o.transform.localScale = new Vector3(sx,sy,sz); o.GetComponent<Renderer>().sharedMaterial = m; UnityEngine.Object.DestroyImmediate(o.GetComponent<Collider>()); return o;
    }
    static void Box(string n, Material m, float x,float y,float z,float w,float h,float d) { Part(n,PrimitiveType.Cube,m,x,y,z,w,h,d); }
    static void Disc(string n, Material m,float x,float y,float z,float r,float h) { Part(n,PrimitiveType.Cylinder,m,x,y,z,r*2,h/2,r*2); }
    static void Ball(string n,Material m,float x,float y,float z,float r) { Part(n,PrimitiveType.Sphere,m,x,y,z,r*2,r*2,r*2); }
    static void Begin(string name) { root = new GameObject(name).transform; }
    static void End(string path, bool linear = false) { Export(root.gameObject,path,linear); }

    // Smooth low-poly primitives for characters: far fewer vertices than Unity's built-in sphere, so a whole squad stays light on tablets.
    static readonly Dictionary<string,Mesh> smooth = new Dictionary<string,Mesh>();
    static Mesh Round() {
        if (smooth.TryGetValue("round", out var cached)) return cached;
        const int lon = 14, lat = 9; var v = new List<Vector3>(); var t = new List<int>();
        for (int i = 0; i <= lat; i++) { float a = Mathf.PI * i / lat; for (int j = 0; j <= lon; j++) { float b = 2 * Mathf.PI * j / lon; v.Add(new Vector3(Mathf.Sin(a) * Mathf.Cos(b), Mathf.Cos(a), Mathf.Sin(a) * Mathf.Sin(b)) * .5f); } }
        for (int i = 0; i < lat; i++) for (int j = 0; j < lon; j++) { int p = i * (lon + 1) + j, q = p + lon + 1; t.AddRange(new[] { p, p + 1, q, q, p + 1, q + 1 }); }
        var mesh = new Mesh { name = "round" }; mesh.SetVertices(v); mesh.SetTriangles(t, 0); mesh.SetNormals(v.ConvertAll(p => p.normalized)); smooth["round"] = mesh; return mesh;
    }
    static Mesh Tube() {
        if (smooth.TryGetValue("tube", out var cached)) return cached;
        const int seg = 12; var v = new List<Vector3>(); var n = new List<Vector3>(); var t = new List<int>();
        for (int j = 0; j <= seg; j++) { float b = 2 * Mathf.PI * j / seg; var r = new Vector3(Mathf.Cos(b), 0, Mathf.Sin(b)); v.Add(r * .5f + Vector3.down * .5f); v.Add(r * .5f + Vector3.up * .5f); n.Add(r); n.Add(r); }
        for (int j = 0; j < seg; j++) { int b0 = j * 2, t0 = b0 + 1, b1 = b0 + 2, t1 = b0 + 3; t.AddRange(new[] { b0, t0, b1, t0, t1, b1 }); }
        for (int cap = 0; cap < 2; cap++) {
            float y = cap == 0 ? .5f : -.5f; int c = v.Count; v.Add(new Vector3(0, y, 0)); n.Add(cap == 0 ? Vector3.up : Vector3.down);
            for (int j = 0; j <= seg; j++) { float b = 2 * Mathf.PI * j / seg; v.Add(new Vector3(Mathf.Cos(b) * .5f, y, Mathf.Sin(b) * .5f)); n.Add(cap == 0 ? Vector3.up : Vector3.down); }
            for (int j = 0; j < seg; j++) t.AddRange(cap == 0 ? new[] { c, c + j + 2, c + j + 1 } : new[] { c, c + j + 1, c + j + 2 });
        }
        var mesh = new Mesh { name = "tube" }; mesh.SetVertices(v); mesh.SetNormals(n); mesh.SetTriangles(t, 0); smooth["tube"] = mesh; return mesh;
    }
    static Transform limb;
    /** A rig node: every child of the root is exported as its own glTF node, pivoted where it was created. */
    static void Limb(string name, float x, float y, float z) { limb = new GameObject(name).transform; limb.SetParent(root, false); limb.position = new Vector3(x, y, z); }
    /** Places a piece in world coordinates under the current limb: shape "box", "round" or "tube" (unit size). */
    static void Piece(string name, string shape, Material m, float x, float y, float z, float sx, float sy, float sz) {
        GameObject o;
        if (shape == "box") { o = GameObject.CreatePrimitive(PrimitiveType.Cube); UnityEngine.Object.DestroyImmediate(o.GetComponent<Collider>()); }
        else { o = new GameObject(); o.AddComponent<MeshFilter>().sharedMesh = shape == "round" ? Round() : Tube(); o.AddComponent<MeshRenderer>(); }
        o.name = name; o.transform.SetParent(limb, false); o.transform.position = new Vector3(x, y, z); o.transform.localScale = new Vector3(sx, sy, sz); o.GetComponent<Renderer>().sharedMaterial = m;
    }
    /**
     * A chunky footballer about one unit tall, facing -z (it faces +z once exported). Kit colors are pure marker
     * colors that the web repaints per team: shirt stripes A/B, shorts, socks, boots, gloves, skin and hair.
     */
    static void Footballer(string output) {
        Begin("Footballer / rigged squad player");
        var shirtA=Paint("#ff00ff"); var shirtB=Paint("#8000ff"); var shorts=Paint("#00ffff"); var skin=Paint("#ffff00"); var hair=Paint("#00ff00"); var socks=Paint("#ff0000"); var boots=Paint("#0000ff"); var gloves=Paint("#ff8000"); var eye=Paint("#1b1b24"); var patch=Paint("#ffffff");
        Limb("body",0,.40f,0);
        Piece("shorts","box",shorts,0,.41f,0,.33f,.15f,.21f);
        for (int i=0;i<5;i++) Piece("shirt stripe","box",i%2==0?shirtA:shirtB,-.16f+i*.08f,.59f,0,.081f,.27f,.22f);
        Piece("collar","box",shirtB,0,.73f,0,.18f,.03f,.15f); Piece("number patch","box",patch,0,.6f,.112f,.11f,.12f,.006f);
        Limb("head",0,.73f,0);
        Piece("neck","tube",skin,0,.75f,0,.09f,.07f,.09f); Piece("head","round",skin,0,.87f,0,.29f,.29f,.29f); Piece("hair","round",hair,0,.92f,.03f,.31f,.22f,.30f);
        for (int s=-1;s<=1;s+=2) { Piece("ear","round",skin,s*.142f,.865f,0,.06f,.07f,.05f); Piece("eye","round",eye,s*.05f,.885f,-.13f,.04f,.05f,.03f); }
        Piece("nose","round",skin,0,.855f,-.142f,.045f,.045f,.04f);
        foreach (var (name,s) in new[]{("armL",-1),("armR",1)}) {
            Limb(name,s*.2f,.69f,0);
            Piece("shoulder","round",shirtA,s*.2f,.685f,0,.12f,.12f,.12f); Piece("sleeve","box",shirtA,s*.215f,.635f,0,.085f,.1f,.1f);
            Piece("arm","round",skin,s*.22f,.53f,0,.07f,.19f,.07f); Piece("hand","round",gloves,s*.22f,.43f,0,.09f,.09f,.09f);
        }
        foreach (var (name,s) in new[]{("legL",-1),("legR",1)}) {
            Limb(name,s*.085f,.36f,0);
            Piece("thigh","round",skin,s*.085f,.29f,0,.085f,.16f,.085f); Piece("sock","tube",socks,s*.085f,.14f,0,.086f,.15f,.086f);
            Piece("boot","box",boots,s*.085f,.035f,-.025f,.085f,.07f,.15f); Piece("toe","round",boots,s*.085f,.035f,-.1f,.085f,.07f,.07f);
        }
        ExportParts(root.gameObject,Path.Combine(output,"footballer.glb"));
    }

    /** A rotated piece (degrees), for spokes, ribs, bristles and tilted handles. */
    static void Turned(string name, string shape, Material m, float x, float y, float z, float sx, float sy, float sz, float rx, float ry, float rz) {
        Piece(name, shape, m, x, y, z, sx, sy, sz); limb.GetChild(limb.childCount - 1).localRotation = Quaternion.Euler(rx, ry, rz);
    }
    /**
     * TOMATINA's cleaning robots (the Limpiabots) and the thrower's arms, in one rigged pack. Every node is named
     * "<model>.<part>" and pivots where it moves. Robots face -z (+z once exported). Colors are greys the web turns
     * into two-tone dither: white panels, light trim, mid grey, and pure black ink. #ff00ff and #00ffff mark the
     * glove and the sleeve of the arms, which the web repaints per thrower.
     */
    static void Limpiabots(string output) {
        Begin("Limpiabots / TOMATINA cleaning robots");
        var white=Paint("#ffffff"); var light=Paint("#d4d4d4"); var mid=Paint("#8a8a8a"); var dark=Paint("#3a3a3a"); var ink=Paint("#000000"); var glove=Paint("#ff00ff"); var sleeve=Paint("#00ffff");
        // MOP BOT: a bucket on wheels with a dome head and a mop arm that scrubs.
        Limb("mop.body",0,0,0);
        Piece("wheel base","tube",dark,0,.1f,0,.62f,.16f,.62f); for(int s=-1;s<=1;s+=2) Turned("wheel","tube",ink,s*.3f,.12f,0,.22f,.08f,.22f,0,0,90);
        Piece("bucket","tube",white,0,.5f,0,.78f,.66f,.78f); Piece("bucket band","tube",mid,0,.62f,0,.8f,.06f,.8f); Piece("bucket rim","tube",light,0,.84f,0,.84f,.06f,.84f);
        Piece("neck","tube",dark,0,.93f,0,.18f,.14f,.18f); Piece("head","round",white,0,1.1f,0,.5f,.38f,.5f); Piece("visor","box",ink,0,1.12f,-.22f,.36f,.1f,.08f);
        Piece("eye","round",white,-.08f,1.12f,-.265f,.06f,.06f,.02f); Piece("antenna","tube",dark,.12f,1.33f,0,.03f,.16f,.03f); Piece("antenna tip","round",ink,.12f,1.43f,0,.07f,.07f,.07f);
        Limb("mop.arm",.36f,.82f,0);
        Piece("shoulder","round",light,.38f,.82f,0,.16f,.16f,.16f); Turned("handle","tube",mid,.46f,.6f,-.38f,.05f,.95f,.05f,-38,0,0);
        Piece("mop head","box",dark,.46f,.2f,-.72f,.24f,.08f,.12f); for(int i=0;i<7;i++) Turned("strand","box",light,.36f+i*.033f,.1f,-.74f-(i%2)*.03f,.026f,.2f,.026f,(i%3-1)*14,0,(i%2==0?1:-1)*8);
        // HOSE BOT: a water tank with a pressure gauge and a hose arm.
        Limb("spray.body",0,0,0);
        for(int s=-1;s<=1;s+=2) for(int k=-1;k<=1;k+=2) Turned("wheel","tube",ink,s*.28f,.12f,k*.22f,.22f,.07f,.22f,0,0,90);
        Piece("chassis","box",dark,0,.22f,0,.64f,.12f,.62f); Piece("tank","box",white,0,.66f,0,.7f,.76f,.6f); Piece("tank stripe","box",mid,0,.5f,-.305f,.71f,.08f,.02f);
        Piece("gauge","tube",light,0,.8f,-.31f,.22f,.03f,.22f); Turned("gauge face","tube",white,0,.8f,-.325f,.18f,.01f,.18f,90,0,0); Turned("needle","box",ink,.03f,.83f,-.335f,.015f,.09f,.01f,0,0,-35);
        Piece("back tank","tube",light,0,.8f,.38f,.36f,.6f,.36f); Piece("cap","round",dark,0,1.12f,.38f,.16f,.1f,.16f);
        Piece("head","box",white,0,1.24f,0,.5f,.34f,.46f); Piece("brow","box",ink,0,1.36f,-.235f,.44f,.05f,.02f); for(int s=-1;s<=1;s+=2) Piece("eye","round",ink,s*.11f,1.25f,-.235f,.09f,.09f,.03f);
        Piece("siren","round",light,0,1.46f,0,.14f,.12f,.14f);
        Limb("spray.hose",.4f,.86f,0);
        Piece("shoulder","round",light,.4f,.86f,0,.18f,.18f,.18f); Piece("arm","tube",mid,.44f,.84f,-.24f,.11f,.11f,.11f); Turned("hose","tube",dark,.44f,.84f,-.3f,.09f,.42f,.09f,90,0,0);
        Turned("nozzle","tube",ink,.44f,.84f,-.55f,.13f,.12f,.13f,90,0,0); Turned("nozzle ring","tube",light,.44f,.84f,-.6f,.16f,.04f,.16f,90,0,0);
        // UMBRELLA BOT: a slim robot holding a big umbrella in front like a shield.
        Limb("umbrella.body",0,0,0);
        Piece("wheel base","tube",dark,0,.1f,0,.5f,.14f,.5f); Piece("body","tube",white,0,.55f,0,.5f,.78f,.44f); Piece("belt","tube",mid,0,.4f,0,.52f,.06f,.46f);
        Piece("head","round",white,0,1.12f,0,.46f,.42f,.46f); for(int s=-1;s<=1;s+=2) Piece("eye","round",ink,s*.1f,1.14f,-.2f,.08f,.1f,.04f); Piece("bow tie","box",ink,0,.92f,-.22f,.18f,.08f,.04f);
        Piece("hat","tube",ink,0,1.36f,0,.36f,.12f,.36f); Piece("hat brim","tube",ink,0,1.3f,0,.52f,.02f,.52f);
        Limb("umbrella.canopy",0,1.0f,-.3f);
        Piece("handle","tube",dark,0,.82f,-.36f,.05f,.5f,.05f); Piece("hook","round",dark,0,.56f,-.36f,.09f,.09f,.09f);
        Piece("canopy","round",white,0,1.05f,-.62f,1.45f,1.45f,.42f); Piece("tip","round",ink,0,1.05f,-.85f,.1f,.1f,.1f);
        for(int i=0;i<8;i++) { float a=i*Mathf.PI/4; Turned("rib","box",ink,Mathf.Cos(a)*.36f,1.05f+Mathf.Sin(a)*.36f,-.79f,.025f,.7f,.02f,0,0,a*Mathf.Rad2Deg-90); }
        Piece("trim","tube",ink,0,1.05f,-.62f,1.47f,.02f,1.47f); limb.GetChild(limb.childCount-1).localRotation=Quaternion.Euler(90,0,0);
        // ROBO VACUUM: a fast disc with a bumper, a sensor eye and a spinning side brush.
        Limb("vac.body",0,0,0);
        Piece("bumper","tube",dark,0,.12f,0,.86f,.16f,.86f); Piece("shell","tube",white,0,.22f,0,.82f,.12f,.82f); Piece("lid","tube",light,0,.3f,0,.56f,.04f,.56f);
        Piece("sensor","tube",ink,0,.36f,.08f,.2f,.08f,.2f); Piece("eye","box",ink,0,.2f,-.42f,.3f,.08f,.04f); Piece("button","tube",mid,0,.33f,-.18f,.1f,.02f,.1f);
        Limb("vac.brush",.3f,.05f,-.3f);
        Piece("hub","tube",ink,.3f,.05f,-.3f,.08f,.04f,.08f); for(int i=0;i<3;i++) Turned("bristle","box",dark,.3f,.05f,-.3f,.03f,.02f,.32f,0,i*60,0);
        // LA GRAN LAVADORA: a giant washing machine with a porthole door and a spinning drum.
        Limb("boss.body",0,0,0);
        for(int s=-1;s<=1;s+=2) for(int k=-1;k<=1;k+=2) Piece("foot","box",ink,s*1.05f,.08f,k*.95f,.32f,.16f,.32f);
        Piece("cabinet","box",white,0,1.6f,0,2.6f,2.9f,2.4f); Piece("top","box",light,0,3.08f,0,2.64f,.1f,2.44f); Piece("panel","box",light,0,2.78f,-1.21f,2.5f,.5f,.04f);
        Piece("display","box",ink,.3f,2.8f,-1.24f,.7f,.26f,.02f); for(int i=0;i<3;i++) Turned("knob","tube",dark,-.9f+i*.32f,2.78f,-1.25f,.2f,.06f,.2f,90,0,0);
        Piece("drawer","box",mid,-.75f,2.42f,-1.22f,.8f,.18f,.04f); Piece("seam","box",ink,0,2.52f,-1.215f,2.6f,.02f,.02f);
        Turned("door well","tube",dark,0,1.45f,-1.2f,1.9f,.03f,1.9f,90,0,0); Turned("drum shadow","tube",ink,0,1.45f,-1.18f,1.5f,.02f,1.5f,90,0,0);
        for(int s=-1;s<=1;s+=2) { Piece("arm","tube",mid,s*1.45f,1.8f,-.2f,.2f,.9f,.2f); Piece("glove","round",light,s*1.45f,1.28f,-.2f,.34f,.34f,.34f); }
        Limb("boss.drum",0,1.45f,-1.15f);
        Turned("drum","tube",mid,0,1.45f,-1.15f,1.36f,.02f,1.36f,90,0,0); for(int i=0;i<3;i++) Turned("paddle","box",white,0,1.45f,-1.17f,.14f,1.1f,.04f,0,0,i*60);
        Limb("boss.door",-.95f,1.45f,-1.25f);
        Turned("door ring","tube",light,0,1.45f,-1.26f,1.92f,.08f,1.92f,90,0,0); Turned("glass","tube",white,0,1.45f,-1.29f,1.5f,.02f,1.5f,90,0,0);
        Piece("handle","box",dark,.82f,1.45f,-1.32f,.12f,.4f,.06f); for(int i=0;i<4;i++) Turned("shine","box",light,-.3f+i*.06f,1.75f-i*.06f,-1.31f,.03f,.3f,.01f,0,0,40);
        // THROWER ARMS: seen from the eyes, reaching forward along -z. The web places them in front of the camera.
        Limb("hand.glove",0,0,0);
        Piece("sleeve","tube",sleeve,0,0,.3f,.17f,.3f,.17f); limb.GetChild(limb.childCount-1).localRotation=Quaternion.Euler(90,0,0); Piece("cuff","tube",white,0,0,.14f,.19f,.04f,.19f); limb.GetChild(limb.childCount-1).localRotation=Quaternion.Euler(90,0,0);
        Piece("wrist","tube",glove,0,0,.06f,.13f,.12f,.12f); limb.GetChild(limb.childCount-1).localRotation=Quaternion.Euler(90,0,0); Piece("palm","box",glove,0,.01f,-.06f,.16f,.08f,.16f);
        for(int i=0;i<4;i++) { Turned("finger","tube",glove,-.055f+i*.037f,.06f,-.15f,.034f,.1f,.034f,-30,0,0); Turned("fingertip","tube",glove,-.055f+i*.037f,.1f,-.1f,.032f,.06f,.032f,-160,0,0); }
        Turned("thumb","tube",glove,-.1f,.05f,-.03f,.04f,.1f,.04f,-40,0,40);
        Limb("hand.mitt",0,0,0);
        Piece("sleeve","tube",sleeve,0,0,.3f,.18f,.3f,.18f); limb.GetChild(limb.childCount-1).localRotation=Quaternion.Euler(90,0,0);
        Piece("cuff","tube",white,0,0,.12f,.22f,.08f,.22f); limb.GetChild(limb.childCount-1).localRotation=Quaternion.Euler(90,0,0);
        Piece("mitt","round",glove,0,.03f,-.08f,.22f,.16f,.3f); Piece("mitt thumb","round",glove,-.12f,.05f,-.04f,.1f,.08f,.14f); Piece("quilt","box",ink,0,.11f,-.08f,.012f,.01f,.22f); Piece("quilt2","box",ink,0,.11f,-.08f,.16f,.01f,.012f);
        Limb("hand.claw",0,0,0);
        Piece("piston","tube",mid,0,0,.3f,.12f,.3f,.12f); limb.GetChild(limb.childCount-1).localRotation=Quaternion.Euler(90,0,0); Piece("joint","round",dark,0,0,.12f,.15f,.15f,.15f);
        Piece("wrist","box",light,0,0,.0f,.16f,.1f,.14f); for(int i=0;i<3;i++) { float a=i*120f*Mathf.Deg2Rad; Turned("prong","box",dark,Mathf.Cos(a)*.06f,Mathf.Sin(a)*.06f+.04f,-.12f,.03f,.03f,.16f,-20*Mathf.Sin(a),20*Mathf.Cos(a),0); }
        Piece("light","round",ink,0,.06f,.02f,.04f,.04f,.04f);
        Limb("hand.gauntlet",0,0,0);
        Piece("vambrace","tube",light,0,0,.3f,.18f,.3f,.18f); limb.GetChild(limb.childCount-1).localRotation=Quaternion.Euler(90,0,0); Piece("rivet band","tube",dark,0,0,.17f,.2f,.03f,.2f); limb.GetChild(limb.childCount-1).localRotation=Quaternion.Euler(90,0,0);
        Piece("cuff","box",white,0,.02f,.06f,.22f,.12f,.14f); Piece("plate","box",light,0,.03f,-.06f,.17f,.08f,.15f);
        for(int i=0;i<4;i++) { Turned("knuckle","box",white,-.055f+i*.037f,.07f,-.15f,.034f,.05f,.1f,-30,0,0); Turned("tip","box",dark,-.055f+i*.037f,.1f,-.1f,.032f,.04f,.05f,-160,0,0); }
        ExportParts(root.gameObject,Path.Combine(output,"limpiabots.glb"));
    }

    [MenuItem("MODBOX/Build web model pack")]
    public static void Build() {
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        var output = Path.GetFullPath(Path.Combine(Application.dataPath,"../../../public/models/unity")); Directory.CreateDirectory(output);
        var white=Paint("#f6f4e9",.25f); var dark=Paint("#213348",.4f); var teal=Paint("#29c6c4",.4f); var chrome=Paint("#cfdae5",.8f); var gold=Paint("#ffc94d",.3f); var glass=Paint("#40647d",.7f);
        Begin("Vacuum / pearl body and lidar");
        Disc("rubber bumper",dark,0,.12f,0,.39f,.18f); Disc("pearl shell",white,0,.23f,0,.38f,.22f); Disc("teal perimeter",teal,0,.31f,0,.382f,.025f); Disc("top plate",white,0,.35f,0,.35f,.06f);
        Disc("lidar base",dark,.07f,.43f,-.04f,.105f,.13f); Disc("lidar cap",white,.07f,.51f,-.04f,.11f,.04f); Box("power button",teal,-.1f,.39f,.12f,.075f,.025f,.06f); Box("front sensor",dark,0,.22f,.378f,.25f,.09f,.035f);
        for(int side=-1;side<=1;side+=2) for(int b=0;b<3;b++) { var o=Part("side brush",PrimitiveType.Cube,dark,side*.31f,.06f,.2f,.035f,.035f,.32f); o.transform.localRotation=Quaternion.Euler(0,b*120,0); }
        End(Path.Combine(output,"vacuum.glb")); root.position = new Vector3(-5,0,0);
        Begin("Monster truck / island stunt body");
        // Axle frame: x forward, y up, axle mounts at y = 0. Pure #ffcc00 marks panels the web palette mod repaints.
        var paint=Paint("#ffcc00",.15f); var grey=Paint("#a3abb7",.2f); var frame=Paint("#2a2f3b",.3f); var red=Paint("#ff4b4b",.1f); var glassDark=Paint("#29313f",.6f); var lamp=Paint("#fff3b8"); var tail=Paint("#ff2f45");
        Box("ladder frame",frame,0,-.12f,0,3.1f,.22f,1.15f); Box("lower body",grey,.05f,.28f,0,3.55f,.56f,1.86f); Box("race stripe",red,.05f,.3f,0,3.58f,.12f,1.9f);
        Box("hood",paint,1.12f,.7f,0,1.36f,.32f,1.8f); Box("hood scoop",frame,.95f,.9f,0,.62f,.12f,.62f); Box("scoop mouth",glassDark,1.27f,.9f,0,.04f,.08f,.5f);
        Box("cab",paint,-.25f,.92f,0,1.36f,.76f,1.72f); Box("roof",paint,-.25f,1.33f,0,1.5f,.12f,1.82f); Box("windscreen",glassDark,.29f,.98f,0,.2f,.5f,1.6f);
        Box("light bar",frame,-.25f,1.47f,0,.3f,.12f,1.5f); for(int i=0;i<4;i++) Box("roof lamp",lamp,-.13f,1.47f,-.54f+i*.36f,.06f,.1f,.22f);
        Box("tailgate",paint,-1.75f,.7f,0,.1f,.3f,1.86f); Box("bed floor",frame,-1.38f,.57f,0,.82f,.04f,1.6f); Box("spare",frame,-1.35f,.74f,0,.5f,.3f,.5f);
        Box("front bumper",grey,1.88f,.12f,0,.2f,.22f,2.02f); Box("bull bar",frame,1.95f,.4f,0,.08f,.3f,1.2f);
        for(int i=0;i<5;i++) Box("grille slat",frame,1.8f,.45f,-.4f+i*.2f,.03f,.24f,.07f);
        for(int side=-1;side<=1;side+=2) {
            Box("side window",glassDark,-.3f,.98f,side*.87f,.9f,.46f,.04f); Box("bed wall",paint,-1.38f,.7f,side*.86f,.82f,.3f,.14f); Box("headlamp",lamp,1.81f,.58f,side*.62f,.06f,.18f,.3f); Box("tail lamp",tail,-1.82f,.45f,side*.7f,.06f,.16f,.25f);
            Box("mirror",frame,.34f,1.02f,side*1.0f,.1f,.16f,.2f); Box("door seam",frame,.0f,.92f,side*.865f,.03f,.62f,.01f); Box("step",grey,-.1f,.02f,side*.98f,1.2f,.08f,.16f);
            Disc("exhaust stack",grey,-1.02f,1.42f,side*.48f,.07f,.6f); Disc("exhaust tip",frame,-1.02f,1.74f,side*.48f,.08f,.06f);
        }
        End(Path.Combine(output,"truck.glb"),true); root.position=new Vector3(0,0,0);
        Begin("Monster tire / voxel lugs");
        // Rolls around z. Radius .72, width .68, hub faces on both sides so either wheel side can face the camera.
        var rubber=Paint("#1d2029"); var lug=Paint("#2e3343"); var hub=Paint("#c3cad4",.6f); var bolt=Paint("#7b8494",.5f);
        var core=Part("carcass",PrimitiveType.Cylinder,rubber,0,0,0,1.3f,.31f,1.3f); core.transform.localRotation=Quaternion.Euler(90,0,0);
        for(int i=0;i<16;i++) { float a=i*Mathf.PI/8; var block=Part("lug",PrimitiveType.Cube,i%2==0?lug:rubber,Mathf.Cos(a)*.66f,Mathf.Sin(a)*.66f,0,.26f,.16f,i%2==0?.7f:.6f); block.transform.localRotation=Quaternion.Euler(0,0,a*Mathf.Rad2Deg); }
        for(int side=-1;side<=1;side+=2) {
            var face=Part("hub",PrimitiveType.Cylinder,hub,0,0,side*.33f,.62f,.02f,.62f); face.transform.localRotation=Quaternion.Euler(90,0,0);
            var cap=Part("hub cap",PrimitiveType.Cylinder,bolt,0,0,side*.36f,.22f,.02f,.22f); cap.transform.localRotation=Quaternion.Euler(90,0,0);
            for(int b=0;b<6;b++) { float a=b*Mathf.PI/3; Box("bolt",bolt,Mathf.Cos(a)*.2f,Mathf.Sin(a)*.2f,side*.35f,.06f,.06f,.03f); }
        }
        End(Path.Combine(output,"tire.glb"),true); root.position=new Vector3(0,0,-3);
        Begin("Cobra / jade guardian");
        var jade=Paint("#31a778",.2f); Ball("head",jade,0,.52f,0,.34f); var hood=Part("hood",PrimitiveType.Sphere,jade,0,.49f,.18f,.86f,1.05f,.27f); var belly=Part("gold throat",PrimitiveType.Sphere,gold,0,.36f,-.12f,.5f,.45f,.22f);
        for(int side=-1;side<=1;side+=2) { Ball("eye",gold,side*.2f,.67f,-.19f,.08f); Ball("pupil",dark,side*.2f,.67f,-.25f,.04f); Box("fang",white,side*.1f,.29f,-.28f,.035f,.13f,.04f); }
        End(Path.Combine(output,"cobra.glb")); root.position=new Vector3(5,0,0);
        Begin("Scrap robot / industrial target");
        Box("torso",teal,0,.7f,0,.72f,.65f,.48f); Box("head",chrome,0,1.23f,0,.62f,.43f,.52f); Box("visor",dark,0,1.27f,-.28f,.53f,.16f,.06f);
        for(int side=-1;side<=1;side+=2) { Ball("eye",gold,side*.14f,1.27f,-.32f,.045f); Box("arm",teal,side*.49f,.67f,0,.22f,.6f,.24f); Box("leg",dark,side*.2f,.18f,0,.23f,.35f,.29f); Box("boot",chrome,side*.2f,.04f,-.08f,.28f,.14f,.45f); } Box("chest core",gold,0,.75f,-.27f,.25f,.2f,.07f);
        End(Path.Combine(output,"robot.glb")); root.position=new Vector3(-3,0,4);
        Begin("Makita / circular saw turret");
        Disc("foot",dark,0,.12f,0,.46f,.24f); Box("housing",teal,0,.53f,0,.72f,.6f,.58f); Box("handle",dark,0,.97f,0,.6f,.14f,.18f); Box("vent",dark,.37f,.55f,0,.04f,.3f,.4f);
        var disc=Part("saw disc",PrimitiveType.Cylinder,chrome,.55f,.74f,0,.92f,.06f,.92f); disc.transform.localRotation=Quaternion.Euler(0,0,90);
        for(int i=0;i<16;i++) { float a=i*Mathf.PI/8; var tooth=Part("tooth",PrimitiveType.Cube,chrome,.55f,.74f+Mathf.Sin(a)*.46f,Mathf.Cos(a)*.46f,.12f,.16f,.14f); tooth.transform.localRotation=Quaternion.Euler(i*22.5f,0,0); }
        End(Path.Combine(output,"turret.glb")); root.position=new Vector3(3,0,4);
        Footballer(output); root.position=new Vector3(0,0,-6); root.localScale=Vector3.one*2;
        Limpiabots(output); root.position=new Vector3(8,0,-6);
        var sun=new GameObject("Sun").AddComponent<Light>(); sun.type=LightType.Directional; sun.intensity=1.3f; sun.transform.rotation=Quaternion.Euler(40,-30,0);
        var camera=new GameObject("Camera").AddComponent<Camera>(); camera.transform.position=new Vector3(10,11,-15); camera.transform.LookAt(new Vector3(0,0,1)); camera.clearFlags=CameraClearFlags.SolidColor; camera.backgroundColor=new Color(.16f,.2f,.28f); RenderSettings.ambientLight=new Color(.6f,.65f,.75f);
        Directory.CreateDirectory(Path.Combine(Application.dataPath,"Scenes")); EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),"Assets/Scenes/ModelGallery.unity"); AssetDatabase.SaveAssets(); Debug.Log("MODBOX_MODEL_EXPORT_OK " + output);
    }

    static string F(float v) { return v.ToString("R",CI); }
    static string V(Vector3 v) { return $"[{F(v.x)},{F(v.y)},{F(v.z)}]"; }
    // Each child of the root becomes its own glTF node, pivoted at that child, so the web can swing limbs. Colors are linear.
    static void ExportParts(GameObject obj,string path) {
        var data=new MemoryStream(); var w=new BinaryWriter(data); var views=new List<string>(); var accessors=new List<string>(); var meshes=new List<string>(); var nodes=new List<string>(); var children=new List<string>();
        int View(long start) { views.Add("{\"buffer\":0,\"byteOffset\":"+start+",\"byteLength\":"+(data.Position-start)+"}"); return views.Count-1; }
        foreach(Transform part in obj.transform) {
            var positions=new List<Vector3>(); var normals=new List<Vector3>(); var colors=new List<Color>(); var indices=new List<uint>(); var min=new Vector3(float.MaxValue,float.MaxValue,float.MaxValue); var max=new Vector3(float.MinValue,float.MinValue,float.MinValue);
            foreach(var filter in part.GetComponentsInChildren<MeshFilter>()) {
                var mesh=filter.sharedMesh; int offset=positions.Count; var vertices=mesh.vertices; var ns=mesh.normals; var color=filter.GetComponent<Renderer>().sharedMaterial.color.linear;
                for(int i=0;i<vertices.Length;i++) { var p=filter.transform.TransformPoint(vertices[i])-part.position; p.z=-p.z; positions.Add(p); min=Vector3.Min(min,p); max=Vector3.Max(max,p); var n=filter.transform.TransformDirection(ns[i]); n.z=-n.z; normals.Add(n.normalized); colors.Add(color); }
                var triangles=mesh.triangles; for(int i=0;i<triangles.Length;i+=3) { indices.Add((uint)(offset+triangles[i])); indices.Add((uint)(offset+triangles[i+2])); indices.Add((uint)(offset+triangles[i+1])); }
            }
            int a=accessors.Count; long start=data.Position;
            foreach(var p in positions) { w.Write(p.x);w.Write(p.y);w.Write(p.z); } accessors.Add("{\"bufferView\":"+View(start)+",\"componentType\":5126,\"count\":"+positions.Count+",\"type\":\"VEC3\",\"min\":"+V(min)+",\"max\":"+V(max)+"}");
            start=data.Position; foreach(var n in normals) { w.Write(n.x);w.Write(n.y);w.Write(n.z); } accessors.Add("{\"bufferView\":"+View(start)+",\"componentType\":5126,\"count\":"+normals.Count+",\"type\":\"VEC3\"}");
            start=data.Position; foreach(var c in colors) { w.Write(c.r);w.Write(c.g);w.Write(c.b);w.Write(c.a); } accessors.Add("{\"bufferView\":"+View(start)+",\"componentType\":5126,\"count\":"+colors.Count+",\"type\":\"VEC4\"}");
            start=data.Position; foreach(var i in indices) w.Write(i); accessors.Add("{\"bufferView\":"+View(start)+",\"componentType\":5125,\"count\":"+indices.Count+",\"type\":\"SCALAR\"}");
            meshes.Add("{\"name\":\""+part.name+"\",\"primitives\":[{\"attributes\":{\"POSITION\":"+a+",\"NORMAL\":"+(a+1)+",\"COLOR_0\":"+(a+2)+"},\"indices\":"+(a+3)+",\"material\":0}]}");
            var pivot=part.position; pivot.z=-pivot.z; nodes.Add("{\"name\":\""+part.name+"\",\"mesh\":"+(meshes.Count-1)+",\"translation\":"+V(pivot)+"}"); children.Add(nodes.Count.ToString());
        }
        w.Flush(); var bin=data.ToArray();
        string json="{\"asset\":{\"version\":\"2.0\",\"generator\":\"MODBOX Unity 6 model studio\"},\"scene\":0,\"scenes\":[{\"nodes\":[0]}],\"nodes\":[{\"name\":\""+obj.name.Split('/')[0].Trim()+"\",\"children\":["+string.Join(",",children)+"]},"+string.Join(",",nodes)+"],\"meshes\":["+string.Join(",",meshes)+"],\"materials\":[{\"pbrMetallicRoughness\":{\"baseColorFactor\":[1,1,1,1],\"metallicFactor\":0.05,\"roughnessFactor\":0.6}}],\"buffers\":[{\"byteLength\":"+bin.Length+"}],\"bufferViews\":["+string.Join(",",views)+"],\"accessors\":["+string.Join(",",accessors)+"]}";
        while(Encoding.UTF8.GetByteCount(json)%4!=0) json+=" "; var bytes=Encoding.UTF8.GetBytes(json);
        using(var stream=File.Create(path)) using(var o=new BinaryWriter(stream)) { o.Write(0x46546C67u); o.Write(2u); o.Write((uint)(12+8+bytes.Length+8+bin.Length)); o.Write((uint)bytes.Length); o.Write(0x4E4F534Au); o.Write(bytes); o.Write((uint)bin.Length); o.Write(0x004E4942u); o.Write(bin); }
    }
    // Linear exports store vertex colors in glTF linear space, so the web renders the exact authored hex.
    static void Export(GameObject obj,string path,bool linear=false) {
        var positions=new List<Vector3>(); var normals=new List<Vector3>(); var colors=new List<Color>(); var indices=new List<uint>(); var min=new Vector3(float.MaxValue,float.MaxValue,float.MaxValue); var max=new Vector3(float.MinValue,float.MinValue,float.MinValue);
        foreach(var filter in obj.GetComponentsInChildren<MeshFilter>()) {
            var mesh=filter.sharedMesh; var transform=filter.transform; int offset=positions.Count; var vertices=mesh.vertices; var ns=mesh.normals; var color=filter.GetComponent<Renderer>().sharedMaterial.color;
            for(int i=0;i<vertices.Length;i++) { var p=transform.TransformPoint(vertices[i]); p.z=-p.z; positions.Add(p); min=Vector3.Min(min,p); max=Vector3.Max(max,p); var n=transform.TransformDirection(ns[i]); n.z=-n.z; normals.Add(n); colors.Add(linear?color.linear:color); }
            var triangles=mesh.triangles; for(int i=0;i<triangles.Length;i+=3) { indices.Add((uint)(offset+triangles[i])); indices.Add((uint)(offset+triangles[i+2])); indices.Add((uint)(offset+triangles[i+1])); }
        }
        int count=positions.Count, posBytes=count*12, normalBytes=count*12, colorBytes=count*16, indexBytes=indices.Count*4, total=posBytes+normalBytes+colorBytes+indexBytes;
        string vecMin=$"[{F(min.x)},{F(min.y)},{F(min.z)}]", vecMax=$"[{F(max.x)},{F(max.y)},{F(max.z)}]";
        string json="{\"asset\":{\"version\":\"2.0\",\"generator\":\"MODBOX Unity 6 model studio\"},\"scene\":0,\"scenes\":[{\"nodes\":[0]}],\"nodes\":[{\"mesh\":0}],\"meshes\":[{\"primitives\":[{\"attributes\":{\"POSITION\":0,\"NORMAL\":1,\"COLOR_0\":2},\"indices\":3,\"material\":0}]}],\"materials\":[{\"pbrMetallicRoughness\":{\"baseColorFactor\":[1,1,1,1],\"metallicFactor\":0.2,\"roughnessFactor\":0.45}}],\"buffers\":[{\"byteLength\":"+total+"}],\"bufferViews\":[{\"buffer\":0,\"byteOffset\":0,\"byteLength\":"+posBytes+"},{\"buffer\":0,\"byteOffset\":"+posBytes+",\"byteLength\":"+normalBytes+"},{\"buffer\":0,\"byteOffset\":"+(posBytes+normalBytes)+",\"byteLength\":"+colorBytes+"},{\"buffer\":0,\"byteOffset\":"+(posBytes+normalBytes+colorBytes)+",\"byteLength\":"+indexBytes+"}],\"accessors\":[{\"bufferView\":0,\"componentType\":5126,\"count\":"+count+",\"type\":\"VEC3\",\"min\":"+vecMin+",\"max\":"+vecMax+"},{\"bufferView\":1,\"componentType\":5126,\"count\":"+count+",\"type\":\"VEC3\"},{\"bufferView\":2,\"componentType\":5126,\"count\":"+count+",\"type\":\"VEC4\"},{\"bufferView\":3,\"componentType\":5125,\"count\":"+indices.Count+",\"type\":\"SCALAR\"}]}";
        while(Encoding.UTF8.GetByteCount(json)%4!=0) json+=" "; var bytes=Encoding.UTF8.GetBytes(json);
        using(var stream=File.Create(path)) using(var w=new BinaryWriter(stream)) { w.Write(0x46546C67u); w.Write(2u); w.Write((uint)(12+8+bytes.Length+8+total)); w.Write((uint)bytes.Length); w.Write(0x4E4F534Au); w.Write(bytes); w.Write((uint)total); w.Write(0x004E4942u); foreach(var p in positions) { w.Write(p.x);w.Write(p.y);w.Write(p.z); } foreach(var n in normals) { w.Write(n.x);w.Write(n.y);w.Write(n.z); } foreach(var c in colors) { w.Write(c.r);w.Write(c.g);w.Write(c.b);w.Write(c.a); } foreach(var i in indices) w.Write(i); }
    }
}
