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
        var sun=new GameObject("Sun").AddComponent<Light>(); sun.type=LightType.Directional; sun.intensity=1.3f; sun.transform.rotation=Quaternion.Euler(40,-30,0);
        var camera=new GameObject("Camera").AddComponent<Camera>(); camera.transform.position=new Vector3(10,11,-15); camera.transform.LookAt(new Vector3(0,0,1)); camera.clearFlags=CameraClearFlags.SolidColor; camera.backgroundColor=new Color(.16f,.2f,.28f); RenderSettings.ambientLight=new Color(.6f,.65f,.75f);
        Directory.CreateDirectory(Path.Combine(Application.dataPath,"Scenes")); EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),"Assets/Scenes/ModelGallery.unity"); AssetDatabase.SaveAssets(); Debug.Log("MODBOX_MODEL_EXPORT_OK " + output);
    }

    static string F(float v) { return v.ToString("R",CI); }
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
