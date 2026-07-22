# Lumina v2 开发路线图

## 项目概述

**项目名称**: Lumina v2  
**框架**: React Native (Expo) + TypeScript  
**后端**: InsForge (PostgreSQL + Cloud Functions + Storage)  
**目标用户**:  Ministry  le Feu de l'Evangile de Jésus-Christ (MFE-JC) 教会管理  
**架构特点**: 多教会隔离 + 动态功能模块 + 离线优先

---

## 阶段一：项目基础设施与核心框架（Weeks 1-2）

### Week 1: 项目初始化与环境搭建

#### Day 1-2: Expo + TypeScript 项目设置
- [ ] 初始化 Expo 项目 (`npx create-expo-app lumina-app --template typescript`)
- [ ] 配置 TypeScript 严格模式 (strict: true)
- [ ] 设置 ESLint + Prettier 代码规范
- [ ] 配置 Husky pre-commit hooks (lint-staged + type checking)
- [ ] 设置 GitHub Actions CI/CD 流程

#### Day 3-4: 架构分层实施
- [ ] 创建目录结构遵循 Clean Architecture:
  ```
  src/
    ├── core/          # 核心基础设施
    │   ├── auth/      # 认证服务
    │   ├── network/   # 网络层 (InsForge API 封装)
    │   ├── storage/   # 本地存储 (SQLite)
    │   └── sync/      # 离线同步引擎 ⭐重点
    ├── features/      # 业务功能模块
    │   ├── finance/   # 财务管理 (高优先级)
    │   ├── members/   # 成员管理
    │   ├── groups/    # 动态群组
    │   ├── events/    # 事件管理
    │   └── celebrations/ # 礼拜安排
    ├── shared/        # 共享组件和工具
    │   ├── components/
    │   ├── utils/
    │   └── hooks/
    └── navigation/    # 路由配置 (Expo Router)
  ```
- [ ] 实现依赖注入容器 (InversifyJS 或自定义 DI)

#### Day 5-7: 路由与导航系统
- [ ] 配置 Expo Router 文件系统路由
- [ ] 实现认证守卫中间件 (auth guards)
- [ ] 设置权限检查 (基于用户的 church_id + role)
- [ ] 实现路由懒加载策略

### Week 2: 认证、多租户与安全

#### Day 8-9: InsForge 集成
- [ ] 安装 InsForge SDK (`@insforge/sdk`)
- [ ] 配置 RLS (Row-Level Security) 策略
- [ ] 实现 JWT 认证流程
- [ ] 设置数据库连接池优化

#### Day 10-11: 多租户架构实施 ⭐关键
- [ ] 实现 `TenantContext` 全局状态管理
- [ ] 设计数据库隔离策略:
  - **Schema-per-Tenant** (推荐): 每个教会独立 schema
  - **Row-level isolation**: 所有数据在同一表，通过 `church_id` 隔离
  - **物理分离**: 每个教会有独立数据库实例 (大型企业级)
- [ ] 实施 RLS 政策确保数据隔离:
  ```sql
  -- 示例: 教会数据隔离策略
  CREATE POLICY church_isolation ON transactions
    FOR ALL
    USING (church_id = current_setting('app.current_church_id')::uuid);
  ```

#### Day 12-14: 角色权限系统 (RBAC)
- [ ] 定义角色层级 (Super Admin → Church Admin → Manager → Member)
- [ ] 实现权限矩阵表 (permissions_matrix.json)
- [ ] 动态权限分配接口 (为群组功能做准备)
- [ ] 审计日志记录系统

---

## 阶段二：核心业务功能开发（Weeks 3-6）⭐ 最高优先级

### Week 3-4: 财务管理系统 (Finance Module)

这是整个项目的核心模块，需要最高级别的测试覆盖率和代码质量。

#### 金融事务类型定义
```typescript
interface Transaction {
  id: string;           // UUID
  churchId: string;     // 严格关联教会
  type: 'income' | 'expense';
  amount: number;       // Decimal 类型避免浮点精度问题
  category: string;     // 会计科目
  date: Date;
  description: string;
  receipt?: string;     // 附件 URL
  status: TransactionStatus;
  createdBy: string;
  validatedBy?: string; // 验证人 ID
}

type TransactionStatus = 
  | 'draft'      // 草稿
  | 'pending'    // 待验证
  | 'validated'  // 已验证
  | 'rejected'   // 被拒绝
  | 'archived';  // 归档
```

#### 实施清单
- [ ] 财务会计模型设计 (支持复式记账)
- [ ] 预算管理系统 (按月/季度/年)
- [ ] 收入登记流程 (什一奉献、奉献、特别捐赠等分类)
- [ ] 支出审批工作流 (三重验证机制)
- [ ] 实时资产负债表生成
- [ ] 财务报表导出 (PDF/Excel 格式)
- [ ] 审计追踪系统 (所有修改必须留痕)
- [ ] 多币种支持 (未来扩展)

#### 测试要求
- [ ] 单元测试覆盖率 >95%
- [ ] E2E 测试: 完整财务流程模拟
- [ ] 压力测试: 1000+ 交易同时处理
- [ ] 安全测试: SQL 注入、XSS 防护

### Week 5: 成员管理系统

- [ ] 成员 CRUD 操作 (搜索、过滤、分页)
- [ ] 家庭关系建模 (父子关系、夫妻关系)
- [ ] 成员生命周期管理 (新成员、确认受洗、转入/转出)
- [ ] 联系信息管理 (电话、地址、紧急联系人)
- [ ] 活动参与追踪
- [ ] 批量导入/导出 (CSV/Excel)

### Week 6: 群组与动态功能系统

这是体现"agnosticism"核心理念的关键模块。

#### 动态功能架构设计
```typescript
// 功能定义 manifest
const FEATURE_MANIFEST = {
  'finance_sub_account': {
    name: 'Group Financial Account',
    permissions: ['budget.view', 'budget.edit', 'transactions.manage'],
    dependencies: ['core.finance'],
    configurable: {
      enableBudgeting: boolean,
      requireApproval: boolean,
      approvalThreshold: number,
    }
  },
  'member_management': {
    name: 'Member Directory',
    permissions: ['members.view', 'members.edit'],
    dependencies: ['core.members'],
  },
  // ... more features
};

// 群组配置 schema
interface GroupConfig {
  groupId: string;
  groupName: string;
  churchId: string;
  features: Array<{
    featureKey: keyof typeof FEATURE_MANIFEST;
    settings: Record<string, any>;
  }>;
  assignedMembers: string[];
  adminIds: string[];
}
```

#### 实施清单
- [ ] 动态功能注册中心 (FeatureRegistry)
- [ ] 群组配置 UI (可视化拖拽式功能选择器)
- [ ] 基于配置动态渲染界面组件
- [ ] 权限系统集成 (群组功能 ↔ 用户权限映射)
- [ ] 群组数据统计 (独立于全局统计)

---

## 阶段三：高级功能与用户体验（Weeks 7-8）

### Week 7: 事件管理与日历系统

- [ ] 全日历视图 (月/周/日视图切换)
- [ ] 事件模板系统 (标准主日崇拜、特别聚会等)
- [ ] 重复事件支持
- [ ] 冲突检测与提醒
- [ ]  RSVP 跟踪
- [ ] 与其他日历同步 (Google Calendar API - 预留接口)

### Week 8: 数据分析与报告

- [ ] 仪表盘组件库 (图表、KPI 卡片)
- [ ] 自定义报告构建器
- [ ] 数据可视化集成 (Recharts / Victory)
- [ ] 定时报告发送 (邮件/PDF)
- [ ] 趋势分析与预测 (机器学习集成预留)

---

## 阶段四：离线同步与移动端优化（Weeks 9-10）

### Week 9: 离线架构实施 ⭐关键

这是避免重蹈覆辙的关键模块。我们将采用 **"Local-First"** 架构模式。

#### 技术选型评估

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **WatermelonDB** | React Native 专用、实时同步、性能优秀 | 学习曲线陡、生态较小 | 我们的首选 ✅ |
| **RxDB** | 功能全面、插件丰富 | 体积大 (~40KB gzipped)、复杂 | 大规模企业应用 |
| **PouchDB/CouchDB** | 成熟稳定、双向同步 | 浏览器优先、RN 支持弱 | Web 优先项目 |
| **Realm** | MongoDB 背书、高性能 | 闭源、商业许可问题 | 不考虑 ❌ |
| **自定义 SQLite + Sync** | 完全控制 | 开发成本高、bug 风险大 | 不推荐 ❌ |

#### 离线同步协议设计

```typescript
interface SyncStrategy {
  // 冲突解决策略
  conflictResolution: 'server-wins' | 'client-wins' | 'merge';
  
  // 同步触发条件
  triggers: ['connectivity_change'] | ['scheduled'] | ['manual'];
  
  // 批量大小限制 (避免内存溢出)
  batchSize: 50; // 默认每批 50 条
  
  // 重试机制
  retryPolicy: {
    maxRetries: 3,
    backoff: 'exponential', // linear | exponential | fibonacci
    initialDelayMs: 1000
  };
}
```

#### 实施要点
- [ ] 使用 WatermelonDB 作为本地数据库引擎
- [ ] 实现双向同步: local ↔ cloud
- [ ] 冲突检测与合并算法
- [ ] 增量同步 (只传输变化部分)
- [ ] 队列管理 (离线时暂存操作，联网后自动执行)
- [ ] 数据一致性保证 (最终一致性模型)
- [ ] 性能监控 (同步耗时、失败率统计)

#### 测试重点
- [ ] 弱网环境下的稳定性测试
- [ ] 多设备并发编辑同一记录的冲突处理
- [ ] 长时间离线后的首次同步性能
- [ ] 大数据量同步 (10k+ 记录) 的内存占用

### Week 10: 移动端优化

- [ ] 手势优化 (滑动、长按、拖拽)
- [ ] 动画流畅性调整 (60fps 目标)
- [ ] 图片压缩与懒加载
- [ ] 内存泄漏排查与修复
- [ ] 启动速度优化 (<2 秒冷启动)
- [ ] 无障碍访问支持 (VoiceOver/TalkBack)

---

## 阶段五: 部署与运维（Weeks 11-12）

### Week 11: 自动化部署管道

- [ ] GitHub Actions CI/CD 流水线
- [ ] 单元测试 + 集成测试自动运行
- [ ] 代码质量门禁 (SonarQube/Lint)
- [ ] iOS/Android 打包与签名
- [ ] TestFlight/Play Console 分发

### Week 12: 生产环境上线准备

- [ ] 生产构建优化 (tree shaking、code splitting)
- [ ] 错误监控 (Sentry/Datadog)
- [ ] 性能监控 (APM 工具集成)
- [ ] 用户反馈收集机制
- [ ] 版本更新策略 (OTA updates)
- [ ] 文档编写 (API doc、user manual)

---

## 关键技术决策记录

### KDS-001: 为什么选 WatermelonDB 而不是 SQLite?
- WatermelonDB 提供 reactive subscriptions、自动变更检测、批量操作优化
- 内置冲突解决策略
- 更好的开发者体验 (ORM 层面抽象)
- 社区活跃、文档完善

### KDS-002: 为什么不用 GraphQL?
- REST + OpenAPI 更成熟、工具链更完善
- InsForge 原生支持 RESTful API
- 减少学习成本和技术债务
- 未来可轻松引入 GraphQL 过渡层

### KDS-003: 数据库隔离策略选择
经过评估，我们选择 **Schema-per-Tenant** 方案：
- 优点: 物理隔离最彻底、备份/恢复粒度细、符合合规要求
- 缺点: Schema 变更需要在每个 schema 上执行 (通过迁移脚本解决)
- 折中: 小规模教会可使用 Row-level isolation，大规模教会用 Schema-per-Tenant

---

## 质量保证指标

| 指标 | 目标值 | 测量方法 |
|------|--------|---------|
| 单元测试覆盖率 | ≥90% | Jest/Vitest report |
| E2E 测试通过率 | 100% critical paths | Cypress/Detox |
| 崩溃率 | <0.1% | Sentry dashboard |
| 平均响应时间 | <200ms | APM metrics |
| API 可用性 | 99.9% | UptimeRobot |
| 同步延迟 | <5s (局域网) | Custom monitoring |

---

## 风险管理

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| WatermelonDB 性能问题 | 高 | 中 | 原型验证 + 性能基准测试 |
| 离线同步冲突复杂度高 | 高 | 高 | 简化冲突策略、充分测试 |
| InsForge 成熟度不足 | 中 | 低 | 备选 Supabase (可回退) |
| 多租户数据泄露 | 极高 | 低 | RLS 强制校验、渗透测试 |
| 团队成员学习曲线 | 中 | 中 | 内部培训、知识库建设 |

---

## 下一步行动

1. ✅ PRD 完成
2. 🔄 当前: 开始 Phase 0 实施
3. 🔮 后续: 每周同步进度、调整优先级

**注意**: 此 roadmap 是动态文档，应根据实际开发情况持续更新。
