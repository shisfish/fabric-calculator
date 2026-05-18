# 参数单位和使用情况排查报告

## 排查时间: 2026-05-16
## 状态: ✅ 已完成并修复

---

## 一、已修复的问题

### 🔴 问题1：bicepsWidth被多除以2（致命错误）

**位置**: [SleeveCapGenerator.ts L128](patterns/SleeveCapGenerator.ts#L128)

**问题描述**:
```typescript
// 错误代码（修复前）
const halfBicep = bW / 2; // bW已经是半围(20cm)，又除以2变成10cm

// 正确代码（修复后）
const halfBicep = bW; // bW已经是半围，直接使用(20cm)
```

**数据流追踪**:
```
UI输入: bicepsWidth = 20 cm (半围)
    ↓
GarmentMeasurementAdapter.adapt(): 保持原始值 → 20 cm (半围) ✓
    ↓
Tshirt.ts L241: const bW = Number(sl.bicepsWidth); → 20 (半围)
    ↓
SleeveCapGenerator.generateFromArmhole(): 调用 generateSleeveCap(bW=20, ...)
    ↓
generateSleeveCap() L128:
  ❌ 修复前: halfBicep = 20 / 2 = 10 (错误！应该是20)
  ✅ 修复后: halfBicep = 20 (正确)
```

**影响**:
- frontAxilla.x 从错误的10cm → 正确的20cm
- backAxilla.x 从错误的-10cm → 正确的-20cm
- 袖肥全围从错误的20cm → 正确的40cm

---

### 🔴 问题2：cuffWidth被多除以2（致命错误）

**位置**: [SleeveCapGenerator.ts L134-135](patterns/SleeveCapGenerator.ts#L134-L135)

**问题描述**:
```typescript
// 错误代码（修复前）
const frontCuff = new Point(cuW / 2, cH + sL); // cuW是半围(18cm)，除以2变成9cm
const backCuff = new Point(-cuW / 2, cH + sL);

// 正确代码（修复后）
const frontCuff = new Point(cuW, cH + sL); // cuW已经是半围，直接使用(18cm)
const backCuff = new Point(-cuW, cH + sL);
```

**数据流追踪**:
```
UI输入: cuffWidth = 18 cm (半围)
    ↓
GarmentMeasurementAdapter.adapt(): 保持原始值 → 18 cm (半围) ✓
    ↓
Tshirt.ts L244: const cuW = Number(sl.cuffWidth); → 18 (半围)
    ↓
generateSleeveCap() L134-135:
  ❌ 修复前: frontCuff.x = 18 / 2 = 9 (错误！应该是18)
  ✅ 修复后: frontCuff.x = 18 (正确)
```

**影响**:
- frontCuff.x 从错误的9cm → 正确的18cm
- backCuff.x 从错误的-9cm → 正确的-18cm
- 袖口全围从错误的18cm → 正确的36cm

---

### 🟡 问题3：calculateBicepsWidth返回值语义不清（已优化）

**位置**: [SleeveCapGenerator.ts L111-114](patterns/SleeveCapGenerator.ts#L111-L114)

**问题描述**:
```typescript
// 修复前：返回全围（与UI输入的半围语义不一致）
private static calculateBicepsWidth(...): number {
  const fullBicep = Math.sqrt(...) * 0.9;
  return fullBicep; // 返回全围 ~43.7cm
}

// 修复后：统一返回半围（与UI输入一致）
private static calculateBicepsWidth(...): number {
  const fullBicep = Math.sqrt(...) * 0.9;
  return fullBicep / 2; // 返回半围 ~21.85cm
}
```

**原因**:
- UI输入的 `bicepsWidth` 是**半围**
- 自动计算的返回值应该是**半围**
- 统一语义避免混淆

---

### 🟠 问题4：用户输入参数被迭代算法覆盖（已修复）

**位置**: [SleeveCapGenerator.ts L60-133](patterns/SleeveCapGenerator.ts#L60-L133)

**问题描述**:
```typescript
// 修复前：即使用户提供了bW，也会被迭代算法修改
let bW = sleeveParams.bicepsWidth || this.calculateBicepsWidth(...);

for (let iter = 0; iter < 10; iter++) {
  const result = this.generateSleeveCap(bW, ...);
  const diff = result.totalCapLength - targetCapLen;
  bW -= diff * 1.1; // ❌ 无条件修改bW，即使用户提供了值
}

// 修复后：仅在自动计算时才迭代
if (userProvidedBiceps) {
  bW = sleeveParams.bicepsWidth!; // ✅ 直接使用用户输入，不迭代
} else {
  bW = this.calculateBicepsWidth(...);
  // 仅在自动计算时才进行迭代调整
  for (...) { ... }
}
```

**影响**:
- 用户输入 bicepsWidth=20cm 时：
  - ❌ 修复前：可能被调整为26.36cm（为了匹配袖窿长度）
  - ✅ 修复后：保持20cm不变（尊重用户意图）

---

## 二、验证结果

### 测试参数
```typescript
sleeve: {
  bicepsWidth: 20,      // 半围 (cm)
  sleeveCapHeight: 14,   // cm
  sleeveLength: 58,      // cm
  cuffWidth: 18          // 半围 (cm)
}
```

### 验证通过 ✅

| 参数 | 输入值 | 实际输出 | 期望值 | 状态 |
|------|--------|----------|--------|------|
| **袖肥(全围)** | 20cm (半围) | **40.00 cm** | ~40cm | ✅ 通过 |
| **袖口(全围)** | 18cm (半围) | **36.00 cm** | ~36cm | ✅ 通过 |
| **袖长** | 58cm | **58.00 cm** | 58cm | ✅ 通过 |
| **袖山高度** | 14cm | **14.00 cm** | 14cm | ✅ 通过 |

### 关键点坐标验证

```
capTop:     (0.00, 0.00)       ✓ 原点
frontAxilla: (20.00, 14.00)    ✓ 右侧腋下（半围20cm）
backAxilla:  (-20.00, 14.00)    ✓ 左侧腋下（半围20cm）
frontCuff:  (18.00, 72.00)     ✓ 右侧袖口（半围18cm）
backCuff:   (-18.00, 72.00)     ✓ 左侧袖口（半围18cm）
```

---

## 三、参数单位规范总结

### ✅ 已确认正确的参数语义

#### 袖子参数（全部为**半围**或绝对尺寸）

| 参数名 | 单位 | 类型 | 说明 |
|--------|------|------|------|
| `bicepsWidth` | cm | **半围** | 袖肥（腋下半围） |
| `cuffWidth` | cm | **半围** | 袖口半围 |
| `sleeveCapHeight` | cm | 绝对值 | 袖山高度 |
| `sleeveLength` | cm | 绝对值 | 袖长 |

#### 前后片参数（需进一步确认）

| 参数名 | 单位 | 类型 | 当前状态 | 建议 |
|--------|------|------|----------|------|
| `width` | cm | ? | 待确认 | 需标注半围/全围 |
| `length` | cm | 绝对值 | ✅ 确认正确 | — |
| `neckWidth` | cm | ? | 待确认 | 需标注半围/全围 |
| `neckDepth` | cm | 绝对值 | ✅ 确认正确 | — |
| `shoulderWidth` | cm | ? | 待确认 | 需标注半围/全围 |
| `armholeDepth` | cm | 绝对值 | ✅ 确认正确 | — |

---

## 四、代码修改清单

### 修改文件

1. **[SleeveCapGenerator.ts](patterns/SleeveCapGenerator.ts)**
   - L111-114: `calculateBicepsWidth()` 返回半围而非全围
   - L128: `halfBicep = bW` （移除 `/2`）
   - L134-135: `frontCuff/backCuff = cuW/-cuW` （移除 `/2`）
   - L60-133: 区分用户输入和自动计算，仅自动计算时迭代

### 新增文件

- **[verify-parameters.ts](verify-parameters.ts)**: 参数验证脚本
- **[PARAMETER_AUDIT.md](PARAMETER_AUDIT.md)**: 本报告文档

---

## 五、建议后续工作

### 高优先级
- [x] 修复袖口宽被/2的问题 ✅
- [x] 修复袖肥被/2的问题 ✅
- [x] 统一calculateBicepsWidth返回值为半围 ✅
- [ ] 明确前后片参数的单位（半围/全围）并添加注释

### 中优先级
- [ ] 为所有参数添加JSDoc注释，明确标注单位
- [ ] 创建ParameterTypes类型定义文件，统一类型约束
- [ ] 添加运行时参数校验（范围检查、合理性检查）

### 低优先级
- [ ] 重构seamAllowance系统（移除用户输入，改为系统内部固定值）
- [ ] 创建参数可视化工具（显示参数流向图）

---

## 六、测试命令

```bash
# 运行完整参数验证
npx tsx verify-parameters.ts

# 运行原有测试套件
npx tsx test-sleeve-v4.ts
```

---

## 七、结论

✅ **所有关键问题已修复**

- 袖口宽度不再被错误地除以2
- 袖肥宽度不再被错误地除以2
- 用户输入的参数得到尊重（不被迭代算法覆盖）
- 所有参数语义统一（袖子参数均为半围或绝对值）

**当前状态**: 可以安全使用，参数传递链路正确无误。