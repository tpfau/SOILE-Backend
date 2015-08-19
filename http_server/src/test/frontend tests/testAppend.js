describe("Builtin append", function() {
  var app = "";

  beforeEach(function() {
    app = SOILE2.bin.append;
  });

  it("appends 2 strings", function() {

    console.log(app("rt-",0));

    var twoStrings1 = app("s1", "s2");
    var twoStrings2 = app("s2", "s1");

    expect(twoStrings1).toBe("s1s2");
    expect(twoStrings2).toBe("s2s1");
  });

  it("appends arrays", function() {
    var arrEmpty = [];
    var arr = ["a", "b", "c"];
    var value = "d";

    app(arrEmpty, arr);
    expect(arr).toContain("a");
    expect(arr).toContain("b");
    expect(arr).toContain("c");
    
    arrEmpty = [];
    app(arrEmpty, value);
    expect(arrEmpty).toContain("d");
  
  });

  it("concateneates two array", function() {
    var arr1 = [1,2,3];
    var arr2 = ["a","b","c"];

    var c = app(arr1, arr2);
""
    expect(arr1).toContain("a");
    expect(arr1).toContain("b");
    expect(arr1).toContain("c");
  })
});